/**
 * gmailWatchRenewal.js
 *
 * Cron job that automatically renews Gmail Pub/Sub watches before they expire.
 *
 * Gmail watches expire after ~7 days. If not renewed, webhook events stop
 * arriving and email ingestion silently breaks.
 *
 * Strategy
 * ─────────
 * - Runs every 12 hours  (cron: "0 * /12 * * *"  i.e. every 12h)
 * • Renews any watch expiring within the next 48 hours
 * • Processes users in batches of 50 with cursor-based pagination
 * • Failures for individual users are logged but never abort the batch
 */

const cron = require('node-cron');
const User = require('../models/User');
const gmailService = require('../services/gmailService');

/** How far ahead to renew (48 hours). */
const RENEWAL_BUFFER_MS = 48 * 60 * 60 * 1000;

/** Users processed per DB query to avoid large in-memory sets. */
const BATCH_SIZE = 50;

/**
 * Renew Gmail watches for all users whose watch expires within RENEWAL_BUFFER_MS.
 *
 * Uses lastId-based cursor pagination so the same user is never skipped if a
 * previous batch partially failed and the function is re-entered.
 *
 * @returns {Promise<{ renewed: number, failed: number }>}
 */
async function renewGmailWatches() {
  const TAG = '[GmailWatchRenewal]';
  const cutoff = new Date(Date.now() + RENEWAL_BUFFER_MS);

  console.log(`${TAG} Starting renewal run — cutoff=${cutoff.toISOString()}`);

  let renewed = 0;
  let failed = 0;
  let lastId = null; // cursor for pagination

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Build the base filter: watch is expiring soon OR has already expired OR
    // the field is missing entirely (e.g. watch was never set up).
    const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

    const filter = {
      grantedScopes: GMAIL_SCOPE,
      gmailAuthRevoked: { $ne: true },
      $or: [
        { gmailWatchExpiry: { $lt: cutoff } },
        { gmailWatchExpiry: { $exists: false } },
        { gmailWatchExpiry: null },
      ],
    };

    // Cursor: skip documents before the last processed _id so we never
    // re-process or re-scan the same page.
    if (lastId) {
      filter._id = { $gt: lastId };
    }

    const batch = await User.find(filter)
      .sort({ _id: 1 })   // stable sort required for cursor pagination
      .limit(BATCH_SIZE)
      .select('_id gmailWatchExpiry') // minimal projection — setupWatch re-fetches user
      .lean();

    if (batch.length === 0) break; // no more users

    console.log(`${TAG} Processing batch of ${batch.length} users`);

    for (const user of batch) {
      const userId = user._id.toString();
      try {
        await gmailService.setupWatch(userId);
        console.log(`${TAG} ✓ Renewed watch for user ${userId}`);
        renewed++;
      } catch (err) {
        // Log and continue — one user's failure must not block others.
        console.error(`${TAG} ✗ Failed to renew watch for user ${userId}: ${err.message}`);
        failed++;
      }
    }

    lastId = batch[batch.length - 1]._id;

    // If this batch was smaller than the page size we've exhausted the cursor.
    if (batch.length < BATCH_SIZE) break;
  }

  console.log(`${TAG} Run complete — renewed=${renewed}, failed=${failed}`);
  return { renewed, failed };
}

/**
 * Register the Gmail Watch renewal cron job.
 *
 * Runs at minute 0 of every 12th hour  (00:00 and 12:00 UTC).
 * node-cron expression: '0 * /12 * * *'  (every 12 hours)
 *
 * Call once during server startup AFTER the DB connection is established.
 */
function registerGmailWatchRenewalJob() {
  // Validate the expression at registration time so a bad cron string
  // fails fast rather than silently never firing.
  const CRON_EXPRESSION = '0 */12 * * *';

  if (!cron.validate(CRON_EXPRESSION)) {
    throw new Error(`[GmailWatchRenewal] Invalid cron expression: "${CRON_EXPRESSION}"`);
  }

  const task = cron.schedule(CRON_EXPRESSION, async () => {
    try {
      await renewGmailWatches();
    } catch (err) {
      // Top-level catch so an unexpected error never crashes the process.
      console.error('[GmailWatchRenewal] Unhandled error in renewal run:', err.message);
    }
  });

  console.log('[GmailWatchRenewal] Cron job registered — runs every 12 hours');

  return task; // caller can call task.stop() if needed (e.g. graceful shutdown)
}

module.exports = {
  registerGmailWatchRenewalJob,
  renewGmailWatches, // exported for manual trigger / testing
};
