const { updateAppStatusInternal } = require('../controllers/updateAppStatusController');
const { MAX_SYNC_FAILURES } = require('../utils/Constants');

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

    await updateAppStatusInternal(userId, { $inc: incOps });
}

/**
 * From a list of failed messageIds, return only those that are still
 * retryable (i.e., their failure count has NOT yet reached MAX_SYNC_FAILURES).
 *
 * @param {string[]} failedMessageIds
 * @param {Map<string,number>|Object} priorSyncFailures - failure counts BEFORE this round's increment
 * @returns {string[]}
 */
function getRetryableFailures(failedMessageIds, priorSyncFailures) {
    if (!failedMessageIds || failedMessageIds.length === 0) return [];

    return failedMessageIds.filter((id) => {
        // Support both Mongoose Map and plain object (lean)
        const count = priorSyncFailures instanceof Map
            ? (priorSyncFailures.get(id) || 0)
            : (priorSyncFailures?.[id] || 0);
        // After this round's increment the count will be count+1.
        // If count+1 >= MAX_SYNC_FAILURES the message becomes poison — not retryable.
        return (count + 1) < MAX_SYNC_FAILURES;
    });
}

/**
 * Shared "should we move the sync cursor forward" policy, used identically
 * for Gmail historyId (webhook / manual sync) and emailLastSyncedAt
 * (lookback-based sync): a single message that keeps failing must not be
 * allowed to block discovery of every email behind it forever, but a
 * transient failure should still get retried before the cursor moves past it.
 *
 * - No failures this round → advance immediately.
 * - Some failures, at least one still retryable → do NOT advance; the same
 *   messages will be re-attempted on the next sync (cursor untouched).
 * - Failures, all of them now poison (>= MAX_SYNC_FAILURES) → advance anyway
 *   so the poison message(s) stop blocking everything after them.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.userId
 * @param {string[]} params.failedMessageIds
 * @param {Map<string,number>|Object} params.priorSyncFailures - AppStatus.syncFailures read BEFORE this sync ran
 * @param {() => Promise<void>} params.onAdvance - called if/when the cursor should move forward
 * @param {string} params.context - log tag, e.g. '[syncHistorySince]'
 * @returns {Promise<{ advanced: boolean, retryableCount: number, poisonCount: number }>}
 */
async function reconcileSyncFailures({ userId, failedMessageIds, priorSyncFailures, onAdvance, context }) {
    if (!failedMessageIds || failedMessageIds.length === 0) {
        await onAdvance();
        return { advanced: true, retryableCount: 0, poisonCount: 0 };
    }

    await incrementSyncFailures(userId, failedMessageIds);

    const retryable = getRetryableFailures(failedMessageIds, priorSyncFailures);
    const poisonCount = failedMessageIds.length - retryable.length;

    if (retryable.length > 0) {
        console.warn(
            `${context} Retaining cursor — ${retryable.length} retryable failure(s): [${retryable.join(', ')}]`
        );
        return { advanced: false, retryableCount: retryable.length, poisonCount };
    }

    console.error(
        `${context} All ${failedMessageIds.length} failure(s) are now poison (>= ${MAX_SYNC_FAILURES} retries). ` +
        `Advancing cursor anyway to unblock the pipeline.`
    );
    await onAdvance();
    return { advanced: true, retryableCount: 0, poisonCount };
}

module.exports = {
    incrementSyncFailures,
    getRetryableFailures,
    reconcileSyncFailures,
};
