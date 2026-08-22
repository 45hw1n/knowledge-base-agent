const mongoose = require("mongoose");
const EmailToProcess = require("../models/EmailToProcess");
const { extractAndPersistEntity } = require("../ai/orchestrator");
const { updateAppStatusInternal } = require("../controllers/updateAppStatusController");

const BATCH_SIZE = 5;
const INTER_BATCH_DELAY_MS = 500;
const AI_CONCURRENCY_LIMIT = 3;

// Mirrors the stale-lock timeout already used for AppStatus's emailSyncStatus
// lock (see webhookController.js) — a lock older than this is assumed to
// belong to a crashed/killed worker, not one still genuinely in flight.
const PROCESSING_LOCK_STALE_TIMEOUT_MS = 5 * 60 * 1000;

// How long a record may sit in PROCESSING before it's assumed to belong to a
// crashed/killed worker rather than one still genuinely in flight. Mirrors
// the same crash-recovery pattern already used for AppStatus's
// emailSyncStatus/syncStartedAt lock (see webhookController.js).
const PROCESSING_STALE_TIMEOUT_MS = 10 * 60 * 1000;

class Semaphore {
  constructor(max) {
    this._max = max;
    this._active = 0;
    this._queue = [];
  }

  acquire() {
    if (this._active < this._max) {
      this._active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this._queue.push(resolve));
  }

  release() {
    this._active--;
    if (this._queue.length > 0) {
      this._active++;
      this._queue.shift()();
    }
  }
}

const aiConcurrencyLimit = new Semaphore(AI_CONCURRENCY_LIMIT);

/**
 * Split an array into chunks of a given size.
 */
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Reclaim emails stuck in PROCESSING because the worker that locked them
 * died (crash, restart, OOM-kill) before it could write a terminal status.
 * Without this, such a record is permanently invisible: PROCESSING is not
 * one of the statuses processEmails() is willing to re-lock, and the
 * default query only ever looks at DETECTED — so a mid-batch crash would
 * otherwise strand that email forever, silently, with no error surfaced
 * anywhere. Resetting to RETRY_PENDING makes it eligible to be picked up
 * (and re-locked) by the very next processEmails() call.
 *
 * @param {string|ObjectId} userId
 */
async function reclaimStaleProcessing(userId) {
    const staleBefore = new Date(Date.now() - PROCESSING_STALE_TIMEOUT_MS);

    const result = await EmailToProcess.updateMany(
        { accountUserId: userId, status: "PROCESSING", processingStartedAt: { $lt: staleBefore } },
        { $set: { status: "RETRY_PENDING" }, $unset: { processingStartedAt: "" } },
    );

    const reclaimed = result.modifiedCount ?? result.nModified ?? 0;
    if (reclaimed > 0) {
        console.warn(`[EmailProcessor] Reclaimed ${reclaimed} email(s) stuck in PROCESSING (stale > ${PROCESSING_STALE_TIMEOUT_MS}ms)`);
    }
    return reclaimed;
}

/**
 * Process queued emails by querying Mongo and running them through the AI orchestrator.
 * Uses atomic status transitions to prevent race conditions across concurrent workers.
 * Emails are processed in parallel batches of BATCH_SIZE.
 *
 * Also owns the AppStatus `emailProcessingInProgress` lock and
 * `lastEmailAIProcess{StartedAt,CompletedAt,Count}` bookkeeping — moved here
 * (from the GraphQL resolver) so every caller gets identical tracking
 * regardless of trigger source. Previously only the resolver-driven path set
 * these fields, so a webhook's fire-and-forget autoProcess call was
 * completely invisible to any frontend polling AppStatus. See decisions.md.
 *
 * @param {Object} input
 * @param {string|ObjectId} input.userId - Required. Scopes all queries to this user.
 * @param {string[]} [input.ids] - Specific email IDs to process (must belong to userId)
 * @param {string} [input.status] - Filter by status (e.g. DETECTED, RETRY_PENDING, FAILED)
 * @param {number} [input.limit=50] - Max records to process
 * @returns {Object} - { queuedCount, alreadyInProgress? }
 */
async function processEmails({ ids, status, limit = 50, userId } = {}) {
  if (!userId) {
    throw new Error("userId is required for processEmails");
  }

  // ── Acquire the emailProcessingInProgress lock ──────────────────────────
  const lockTimeout = new Date(Date.now() - PROCESSING_LOCK_STALE_TIMEOUT_MS);
  await updateAppStatusInternal(
    userId,
    { $set: { emailProcessingInProgress: false } },
    {
      emailProcessingInProgress: true,
      lastEmailAIProcessStartedAt: { $lt: lockTimeout },
    },
  );

  const lock = await updateAppStatusInternal(
    userId,
    {
      $set: {
        emailProcessingInProgress: true,
        lastEmailAIProcessStartedAt: new Date(),
        lastEmailAIProcessedCount: 0,
      },
    },
    { emailProcessingInProgress: { $ne: true } },
  );

  if (!lock) {
    console.log(`[EmailProcessor] Already in progress for userId=${userId}`);
    return { queuedCount: 0, alreadyInProgress: true };
  }

  try {
    return await runProcessEmails({ ids, status, limit, userId });
  } finally {
    await updateAppStatusInternal(userId, {
      $set: { emailProcessingInProgress: false },
    });
  }
}

/**
 * The actual find-and-process logic, run only once the caller holds the
 * emailProcessingInProgress lock (see processEmails() above).
 */
async function runProcessEmails({ ids, status, limit = 50, userId }) {
  await reclaimStaleProcessing(userId);

  // All branches are scoped to the calling user — prevents cross-tenant access
  let query = { accountUserId: userId };
  let effectiveLimit = limit;

  if (ids && ids.length > 0) {
    const objectIds = ids
      .map((id) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch (e) {
          return null;
        }
      })
      .filter((id) => id !== null);

    query._id = { $in: objectIds };

    // If specific IDs are provided, ensure the limit doesn't truncate the request
    if (effectiveLimit === 50) {
      effectiveLimit = Math.max(50, objectIds.length);
    }
  } else if (status) {
    query.status = status;
  } else {
    query.status = "DETECTED";
  }

  const emails = await EmailToProcess.find(query)
    .sort({ createdAt: 1 })
    .limit(effectiveLimit)
    .lean();

  console.log(
    `[EmailProcessor] Found ${emails.length} emails to process (limit was ${effectiveLimit})`,
  );

  const allowedStatuses = ["DETECTED", "LLM_ERROR", "RETRY_PENDING", "FAILED"];

  let queuedCount = 0;
  const batches = chunkArray(emails, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const results = await Promise.all(
      batch.map(async (email) => {
        const emailId = email._id;
        const locked = await EmailToProcess.findOneAndUpdate(
          { _id: emailId, status: { $in: allowedStatuses } },
          { $set: { status: "PROCESSING", processingStartedAt: new Date() } },
          { new: true },
        );

        if (!locked) {
          const current = await EmailToProcess.findById(emailId)
            .select("status")
            .lean();
          console.log(
            `[EmailProcessor] emailId=${emailId} lock failed. Current status: ${current?.status}, allowed: ${allowedStatuses.join(",")}`,
          );
          return 0;
        }

        const lockedId = locked._id;

        try {
          let extractionResult;
          await aiConcurrencyLimit.acquire();
          try {
            extractionResult = await extractAndPersistEntity(locked);
          } finally {
            aiConcurrencyLimit.release();
          }

          if (extractionResult.error) {
            throw new Error(extractionResult.error);
          }

          await EmailToProcess.updateOne(
            { _id: lockedId, status: "PROCESSING" },
            {
              $set: {
                status: "LLM_PROCESSED",
                LLMProcessedAt: new Date(),
                LLMError: null,
              },
              $unset: { processingStartedAt: "" },
              $inc: { LLMProcessCount: 1 },
            },
          );

          console.log(
            `[EmailProcessor] emailId=${lockedId} processed successfully, type=${extractionResult.type}, entityId=${extractionResult.entityId}`,
          );
          return 1;
        } catch (error) {
          const errorData = error?.message || String(error);
          console.error(
            `[EmailProcessor] emailId=${lockedId} failed: ${errorData}`,
          );

          const isValidationError = errorData.includes(
            "Critical validation failed",
          );
          const nextStatus = isValidationError ? "FAILED" : "LLM_ERROR";

          await EmailToProcess.updateOne(
            { _id: lockedId, status: "PROCESSING" },
            {
              $set: {
                status: nextStatus,
                LLMError: errorData,
                LLMProcessedAt: new Date(),
              },
              $unset: { processingStartedAt: "" },
              $inc: { LLMProcessCount: 1 },
            },
          );
          return 0;
        }
      }),
    );

    queuedCount += results.reduce((sum, val) => sum + val, 0);

    if (i < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
    }
  }

  console.log(
    `[EmailProcessor] Queued ${queuedCount}/${emails.length} emails`,
  );

  await updateAppStatusInternal(userId, {
    $set: {
      lastEmailAIProcessCompletedAt: new Date(),
      lastEmailAIProcessedCount: queuedCount,
    },
  });

  return { queuedCount };
}

async function getEmailsToProcess(userId) {
  const emails = await EmailToProcess.find(
    { accountUserId: userId, status: "DETECTED" },
    { _id: 1 },
  )
    .sort({ createdAt: 1 })
    .lean();

  return {
    count: emails.length,
    ids: emails.map((email) => email._id.toString()),
  };
}

async function getEmailsToProcessByStatus(userId, statuses) {
  const grouped = Object.fromEntries(statuses.map((status) => [status, []]));

  const emails = await EmailToProcess.find({
    accountUserId: userId,
    status: { $in: statuses },
  })
    .select("_id status")
    .lean();

  for (const email of emails) {
    if (!grouped[email.status]) {
      grouped[email.status] = [];
    }

    grouped[email.status].push(email._id.toString());
  }

  return {
    count: emails.length,
    data: statuses.map((status) => ({
      status,
      ids: grouped[status] || [],
    })),
  };
}

module.exports = {
  getEmailsToProcess,
  getEmailsToProcessByStatus,
  processEmails,
  reclaimStaleProcessing,
};
