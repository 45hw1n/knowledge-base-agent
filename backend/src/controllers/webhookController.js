const syncEmailsService = require('../services/syncEmailsService');
const pubsubService = require('../services/pubsubService');
const User = require('../models/User');
const AppStatus = require('../models/AppStatus');
const { updateAppStatus, updateAppStatusInternal } = require('./updateAppStatusController');
const { MAX_SYNC_FAILURES } = require('../utils/Constants');

// ─── Sync Failure Helpers ──────────────────────────────────────────────────

/**
 * Increment the failure counter for each messageId in AppStatus.syncFailures.
 * Uses MongoDB $inc so the update is atomic and does not require a full document read.
 *
 * @param {string|ObjectId} userId
 * @param {string[]} failedMessageIds
 */
async function incrementSyncFailures(userId, failedMessageIds) {
    if (!failedMessageIds || failedMessageIds.length === 0) return;

    const incOps = {};
    for (const msgId of failedMessageIds) {
        // Mongoose Map fields are stored as embedded documents.
        // MongoDB dot-notation works: syncFailures.<key>
        incOps[`syncFailures.${msgId}`] = 1;
    }

    await updateAppStatusInternal(
        userId,
        { $inc: incOps }
    );
}

/**
 * From a list of failed messageIds, return only those that are still
 * retryable (i.e., their failure count has NOT yet reached MAX_SYNC_FAILURES).
 *
 * @param {string[]} failedMessageIds
 * @param {Map<string,number>|Object} syncFailures  - BEFORE this round's increment
 * @returns {string[]}
 */
function getRetryableFailures(failedMessageIds, syncFailures) {
    if (!failedMessageIds || failedMessageIds.length === 0) return [];

    return failedMessageIds.filter(id => {
        // Support both Mongoose Map and plain object (lean)
        const count = syncFailures instanceof Map
            ? (syncFailures.get(id) || 0)
            : (syncFailures?.[id] || 0);
        // After this round's increment the count will be count+1.
        // If count+1 >= MAX_SYNC_FAILURES the message becomes poison — not retryable.
        return (count + 1) < MAX_SYNC_FAILURES;
    });
}

/**
 * Handle incoming Pub/Sub notifications from Gmail
 */
async function handlePubSubNotification(req, res) {
  try {
    if (!(await pubsubService.verifyPubSubMessage(req))) {
      console.log('Invalid Pub/Sub message or unauthorized request');
      return res.status(401).send('Unauthorized');
    }

    // Acknowledge immediately
    res.status(200).send('OK');

    // Process async
    processNotificationAsync(req.body.message).catch(error => {
      console.error('Unhandled error in webhook background processing:', error);
    });
  } catch (error) {
    console.error('Error in webhook handler:', error);
    res.status(500).send('Internal server error');
  }
}

/**
 * Process notification asynchronously
 * Actor: SYSTEM
 */
async function processNotificationAsync(message) {
  try {
    const data = pubsubService.decodeMessage(message);
    const { historyId, emailAddress } = data;
    console.log(`Pub/Sub notification received for ${emailAddress}`);

    if (!historyId) {
      console.log('No historyId in Pub/Sub payload');
      return;
    }

    const user = await User.findOne({ email: emailAddress }).lean();

    if (!user) {
      console.log(`No user found for ${emailAddress}`);
      return;
    }

    if (user.gmailAuthRevoked) {
      console.warn(`${emailAddress} :: Gmail auth revoked — skipping webhook. User must re-authenticate.`);
      return;
    }

    console.log(`${user.displayName} :: ${emailAddress} :: Received Pub/Sub notification`);

    if (!user.historyId) {
      console.log(`${user.displayName} :: ${emailAddress} :: First historyId received. Storing and exiting.`);
      await User.updateOne(
        { _id: user._id },
        { $set: { historyId } }
      );
      return;
    }

    if (BigInt(historyId) <= BigInt(user.historyId)) {
      console.log(`${user.displayName} :: ${emailAddress} :: Stale historyId received. Ignoring.`);
      return;
    }

    console.log(`${user.displayName} :: ${emailAddress} :: Attempting to acquire email sync lock`);

    const lockTimeout = new Date(Date.now() - 5 * 60 * 1000);

    // Step 1 — Expire stale lock (crash recovery).
    await updateAppStatusInternal(
      user._id,
      {
        $set:   { emailSyncStatus: 'IDLE' },
        $unset: { syncStartedAt: '' }
      },
      {
        emailSyncStatus: 'SYNC_IN_PROGRESS',
        syncStartedAt: { $lt: lockTimeout }
      }
    );

    // Step 2 — Clean acquisition.
    const lock = await updateAppStatusInternal(
      user._id,
      { $set: { emailSyncStatus: 'SYNC_IN_PROGRESS', syncStartedAt: new Date() } },
      { emailSyncStatus: 'IDLE' }
    );

    if (!lock) {
      console.log(`${user.displayName} :: ${emailAddress} :: Email sync already in progress. Skipping webhook.`);
      return;
    }

    console.log(`${user.displayName} :: ${emailAddress} :: Acquired emailSyncStatus lock.`);

    try {
      // Load current syncFailures BEFORE the sync so we can:
      //   a) pass them into syncHistorySince (to skip poison emails)
      //   b) classify retryable vs poison failures after sync
      const appStatus = await AppStatus.findOne({ userId: user._id });
      const syncFailures = appStatus?.syncFailures || new Map();

      const result = await syncEmailsService.syncHistorySince(
        user._id.toString(),
        user.historyId,
        syncFailures
      );

      console.log(
        `${user.displayName} :: ${emailAddress} :: Webhook processed ${result.processedCount} emails, ` +
        `${result.failedMessageIds?.length ?? 0} failed`
      );

      // ── Failure handling ─────────────────────────────────────────────────
      if (result.failedMessageIds && result.failedMessageIds.length > 0) {
        // Increment persistent failure counters for all failed messages
        await incrementSyncFailures(user._id, result.failedMessageIds);

        // Determine which failures are still retryable (count BEFORE increment)
        const retryableFailures = getRetryableFailures(result.failedMessageIds, syncFailures);

        if (retryableFailures.length > 0) {
          // Some emails can still recover — hold the cursor so next webhook retries them
          console.warn(
            `${user.displayName} :: ${emailAddress} :: ` +
            `Retaining historyId=${user.historyId} — ${retryableFailures.length} retryable failure(s): ` +
            `[${retryableFailures.join(', ')}]`
          );
        } else {
          // All failures have been exhausted (poison emails) — safe to advance
          console.error(
            `${user.displayName} :: ${emailAddress} :: ` +
            `All ${result.failedMessageIds.length} failure(s) are now poison emails (>= ${MAX_SYNC_FAILURES} retries). ` +
            `Advancing historyId anyway to unblock pipeline.`
          );
          const newHistoryId = result.newestHistoryId || historyId;
          await User.updateOne({ _id: user._id }, { $set: { historyId: newHistoryId } });
          console.log(`${user.displayName} :: ${emailAddress} :: historyId advanced to ${newHistoryId} (after poison-pill drain)`);
        }
      } else {
        // ✅ No failures — safe to advance historyId normally
        const newHistoryId = result.newestHistoryId || historyId;
        await User.updateOne({ _id: user._id }, { $set: { historyId: newHistoryId } });
        console.log(`${user.displayName} :: ${emailAddress} :: historyId advanced to ${newHistoryId}`);
      }

      await updateAppStatus(user._id, {
        emailLastSyncedAt: new Date()
      });

    } finally {
      await updateAppStatusInternal(
        user._id,
        {
          $set: {
            emailSyncStatus: 'IDLE'
          },
          $unset: {
            syncStartedAt: ""
          }
        },
        {
          emailSyncStatus: 'SYNC_IN_PROGRESS'
        }
      );
      console.log(`${user.displayName} :: ${emailAddress} :: Released emailSyncStatus lock.`);
    }

  } catch (error) {
    console.error('Error processing notification:', error);
  }
}

module.exports = {
  handlePubSubNotification,
};
