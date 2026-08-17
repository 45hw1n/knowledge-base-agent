/**
 * Repository: TransactionsToReviewRepository
 *
 * Adapter layer that delegates persistence to transactionsToReviewService.
 * After saving a review record, checks UserPreferences.autoProcess
 * and auto-approves + creates a Transaction if enabled.
 *
 * Called by orchestrator.js — this file's API is unchanged.
 */
const transactionsToReviewService = require('../../../services/transactionsToReviewService');
const UserPreferences = require('../../../models/UserPreferences');

/**
 * Save or update a review document keyed by messageId.
 * If autoProcess is enabled, also auto-approves and creates a Transaction.
 *
 * @param {Object} reviewData - Must include messageId and userId
 * @returns {Object} The created or existing document
 */
const save = async (reviewData) => {
    // 1. Delegate persistence to the service
    const savedReview = await transactionsToReviewService.save(reviewData);

    // 2. Check if auto-process is enabled for this user
    try {
        const prefs = await UserPreferences.findOne({ userId: reviewData.userId }).lean();

        if (prefs?.autoProcess) {
            console.log(`[Repository] AutoProcess enabled for userId=${reviewData.userId}, auto-approving...`);

            // 3. Transition to AUTO_APPROVED
            const approvedReview = await transactionsToReviewService.updateStatus(
                savedReview.messageId,
                'AUTO_APPROVED',
                { approvalActor: 'AI' }
            );

            // 4. Create the Transaction and migrate attachment ownership
            const { transaction } = await transactionsToReviewService.promoteApprovedReview(
                approvedReview,
                'AI'
            );
            console.log(`[Repository] Auto-approved transaction created: ${transaction.displayId}`);

            return savedReview;
        }
    } catch (error) {
        // Auto-approve failure should NOT fail the overall save
        // The review record is already persisted — it can be manually approved later
        console.error(`[Repository] Auto-approve failed for messageId=${reviewData.messageId}:`, error.message);
    }

    return savedReview;
};

/**
 * Find a review document by its messageId.
 * Delegates to transactionsToReviewService.
 */
const findByMessageId = async (messageId) => {
    return transactionsToReviewService.findByMessageId(messageId);
};

/**
 * Transition the status of a review document.
 * Delegates to transactionsToReviewService.
 */
const updateStatus = async (messageId, newStatus, options = {}) => {
    return transactionsToReviewService.updateStatus(messageId, newStatus, options);
};

module.exports = {
    save,
    findByMessageId,
    updateStatus
};
