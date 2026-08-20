const syncEmailsService = require('../services/syncEmailsService');
const pubsubService = require('../services/pubsubService');
const gmailService = require('../services/gmailService');
const User = require('../models/User');
const AppStatus = require('../models/AppStatus');
const UserPreferences = require('../models/UserPreferences');
const { updateAppStatus, updateAppStatusInternal } = require('./updateAppStatusController');
const { reconcileSyncFailures } = require('../services/syncFailureTracker');

/** How far back to look when a webhook's incremental sync can't be trusted
 *  (expired/invalid historyId) and there's no emailLastSyncedAt yet. */
const FALLBACK_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/**
 * Recover from a syncHistorySince() failure — almost always Gmail's history
 * API returning 404/410 because startHistoryId is too old (Gmail only
 * retains history for a limited window). Unlike the login path
 * (config/passport.js#triggerLoginSync), a webhook has no natural moment to
 * re-run this fallback other than the next webhook delivery — without it, a
 * mailbox whose historyId has expired would silently stop ingesting emails
 * until the user happens to log in again.
 *
 * Mirrors triggerLoginSync()'s recovery: re-establish a fresh historyId via
 * setupWatch(), then backfill whatever the broken incremental sync couldn't
 * cover via a date-window search.
 *
 * @returns {Promise<string|null>} the fresh historyId to resume from
 */
async function recoverFromExpiredHistoryId(userId, displayName) {
    const TAG = `${displayName} :: ${userId}`;
    console.warn(`${TAG} :: syncHistorySince failed — attempting expired-historyId recovery`);

    const watch = await gmailService.setupWatch(userId);
    const freshHistoryId = watch?.historyId || null;

    const appStatus = await AppStatus.findOne({ userId }).lean();
    const prefs = await UserPreferences.findOne({ userId }).lean();
    const sinceDate = appStatus?.emailLastSyncedAt
        || prefs?.emailSyncStartDate
        || new Date(Date.now() - FALLBACK_LOOKBACK_MS);

    console.log(`${TAG} :: Recovery: backfilling via syncEmailsByLookback since ${sinceDate.toISOString()}`);
    const result = await syncEmailsService.syncEmailsByLookback(userId, sinceDate);
    console.log(`${TAG} :: Recovery backfill done — processed ${result.processedCount} emails`);

    return freshHistoryId;
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

      let result;
      let recoveredHistoryId = null;
      try {
        result = await syncEmailsService.syncHistorySince(
          user._id.toString(),
          user.historyId,
          syncFailures
        );
      } catch (historyErr) {
        console.error(
          `${user.displayName} :: ${emailAddress} :: syncHistorySince threw: ${historyErr.message}`
        );
        recoveredHistoryId = await recoverFromExpiredHistoryId(user._id.toString(), user.displayName);
        result = { processedCount: 0, failedMessageIds: [], newestHistoryId: recoveredHistoryId };
      }

      console.log(
        `${user.displayName} :: ${emailAddress} :: Webhook processed ${result.processedCount} emails, ` +
        `${result.failedMessageIds?.length ?? 0} failed`
      );

      if (recoveredHistoryId) {
        // The incremental cursor was unrecoverable — the fallback already
        // backfilled the gap via a date-window search, so just adopt the
        // fresh anchor setupWatch() gave us rather than running the normal
        // failure-reconciliation policy against a sync that never ran.
        await User.updateOne({ _id: user._id }, { $set: { historyId: recoveredHistoryId } });
        console.log(`${user.displayName} :: ${emailAddress} :: historyId reset to ${recoveredHistoryId} after recovery`);
      } else {
        // ── Failure handling (same policy as manual/login sync) ────────────
        await reconcileSyncFailures({
          userId: user._id,
          failedMessageIds: result.failedMessageIds,
          priorSyncFailures: syncFailures,
          context: `${user.displayName} :: ${emailAddress} ::`,
          onAdvance: async () => {
            const newHistoryId = result.newestHistoryId || historyId;
            await User.updateOne({ _id: user._id }, { $set: { historyId: newHistoryId } });
            console.log(`${user.displayName} :: ${emailAddress} :: historyId advanced to ${newHistoryId}`);
          },
        });
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
  recoverFromExpiredHistoryId,
};
