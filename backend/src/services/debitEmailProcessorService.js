const mongoose = require("mongoose");
const DebitEmailToProcess = require("../models/DebitEmailToProcess");
const orchestrator = require("../ai/features/processDebitEmails/orchestrator");
const contextBuilder = require("../ai/features/processDebitEmails/context");

const BATCH_SIZE = 5;
const INTER_BATCH_DELAY_MS = 500;
const AI_CONCURRENCY_LIMIT = 3;

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
 * Process debit emails by querying Mongo and running them through the AI orchestrator.
 * Uses atomic status transitions to prevent race conditions across concurrent workers.
 * Emails are processed in parallel batches of BATCH_SIZE.
 *
 * @param {Object} input
 * @param {string|ObjectId} input.userId - Required. Scopes all queries to this user.
 * @param {string[]} [input.ids] - Specific email IDs to process (must belong to userId)
 * @param {string} [input.status] - Filter by status (e.g. DETECTED, RETRY_PENDING, FAILED)
 * @param {number} [input.limit=50] - Max records to process
 * @returns {Object} - { queuedCount }
 */
async function processDebitEmails({ ids, status, limit = 50, userId } = {}) {
  if (!userId) {
    throw new Error("userId is required for processDebitEmails");
  }

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

  const emails = await DebitEmailToProcess.find(query)
    .sort({ createdAt: 1 })
    .limit(effectiveLimit)
    .lean();

  console.log(
    `[DebitEmailProcessor] Found ${emails.length} emails to process (limit was ${effectiveLimit})`,
  );

  const allowedStatuses = ["DETECTED", "LLM_ERROR", "RETRY_PENDING", "FAILED"];

  // Fetch shared data once for the entire batch — userId is guaranteed at this point
  const sharedData = await contextBuilder.fetchSharedData(userId);

  let queuedCount = 0;
  const batches = chunkArray(emails, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const results = await Promise.all(
      batch.map(async (email) => {
        const emailId = email._id;
        const locked = await DebitEmailToProcess.findOneAndUpdate(
          { _id: emailId, status: { $in: allowedStatuses } },
          { status: "PROCESSING" },
          { new: true },
        );

        if (!locked) {
          const current = await DebitEmailToProcess.findById(emailId)
            .select("status")
            .lean();
          console.log(
            `[DebitEmailProcessor] emailId=${emailId} lock failed. Current status: ${current?.status}, allowed: ${allowedStatuses.join(",")}`,
          );
          return 0;
        }

        const lockedId = locked._id;

        try {
          await aiConcurrencyLimit.acquire();
          try {
            await orchestrator.execute({
              emailId: lockedId,
              accountUserId: locked.accountUserId,
            }, sharedData);
          } finally {
            aiConcurrencyLimit.release();
          }

          await DebitEmailToProcess.updateOne(
            { _id: lockedId, status: "PROCESSING" },
            {
              $set: {
                status: "LLM_PROCESSED",
                LLMProcessedAt: new Date(),
                LLMError: null,
              },
              $inc: { LLMProcessCount: 1 },
            },
          );

          console.log(
            `[DebitEmailProcessor] emailId=${lockedId} processed successfully`,
          );
          return 1;
        } catch (error) {
          const errorData = error?.message || String(error);
          console.error(
            `[DebitEmailProcessor] emailId=${lockedId} failed: ${errorData}`,
          );

          const isValidationError = errorData.includes(
            "Critical validation failed",
          );
          const nextStatus = isValidationError ? "FAILED" : "LLM_ERROR";

          await DebitEmailToProcess.updateOne(
            { _id: lockedId, status: "PROCESSING" },
            {
              $set: {
                status: nextStatus,
                LLMError: errorData,
                LLMProcessedAt: new Date(),
              },
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
    `[DebitEmailProcessor] Queued ${queuedCount}/${emails.length} emails`,
  );
  return { queuedCount };
}

async function getDebitEmailsToProcess(userId) {
  const emails = await DebitEmailToProcess.find(
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

async function getDebitEmailsToProcessByStatus(userId, statuses) {
  const grouped = Object.fromEntries(statuses.map((status) => [status, []]));

  const emails = await DebitEmailToProcess.find({
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
  getDebitEmailsToProcess,
  getDebitEmailsToProcessByStatus,
  processDebitEmails,
};
