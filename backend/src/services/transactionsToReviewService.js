/**
 * transactionsToReviewService.js
 *
 * Centralised persistence layer for TransactionsToReview documents.
 * Handles creation, lookup, and status transitions.
 *
 * Extracted from ai/features/processDebitEmails/repository.js
 * so that both the AI pipeline and manual-approval flows
 * share the same service.
 */
const mongoose = require('mongoose');
const TransactionsToReview = require('../models/TransactionsToReview');
const Transaction = require('../models/Transaction');
const CreditCard = require('../models/CreditCard');
const BankAccount = require('../models/BankAccount');
const transactionService = require('./transactionService');
const attachmentService = require('./attachments/attachmentService');
const { AttachmentOwnerType } = require('./attachments/attachmentOwnership');
const { normalizePaymentSource } = require('../utils/paymentSource.utils');

// Fields that the AI pipeline is allowed to update on re-processing
const AI_UPDATABLE_FIELDS = [
    'date',
    'cycle',
    'amount',
    'currency',
    'type',
    'merchantRaw',
    'referenceId',
    'isCreditCardRepayment',
    'name',
    'category',
    'subCategory',
    'paymentMode',
    'paymentSource',
    'LLMMeta'
];
// merchantNormalized is intentionally excluded — immutable after creation

const VALID_TRANSITIONS = {
    READY_TO_REVIEW: ['APPROVED', 'AUTO_APPROVED', 'REJECTED']
};

class ApproveError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

/**
 * Verify payment instrument belongs to the user.
 */
async function verifyPaymentSourceOwnership(userId, paymentSource) {
    if (!paymentSource) return;

    const { refModel, instrumentId } = paymentSource;
    const Model = refModel === 'CreditCard' ? CreditCard : BankAccount;
    const owned = await Model.findOne({ _id: instrumentId, userId }).lean();

    if (!owned) {
        throw new ApproveError(
            'VALIDATION_ERROR',
            'Payment instrument not found or does not belong to user'
        );
    }
}

function pickFieldValue(field) {
    if (!field || typeof field !== 'object') return undefined;
    return {
        id: field.id ?? undefined,
        value: field.value ?? undefined,
        label: field.label ?? undefined
    };
}

/**
 * Compute userApprovedData and review field overrides from UI changes.
 *
 * @param {Object} doc - TransactionsToReview document (mongoose or plain)
 * @param {string|ObjectId} userId
 * @param {Object} changes
 * @returns {{ userApprovedData: Object, reviewFields: Object }}
 */
async function prepareManualApprovalUpdate(doc, userId, changes = {}) {
    const base = doc.toObject ? doc.toObject() : { ...doc };

    if (changes.date !== undefined) {
        base.date = new Date(changes.date);
    }
    if (changes.cycle !== undefined) {
        base.cycle = changes.cycle;
    }
    if (changes.amount !== undefined) {
        base.amount = changes.amount;
    }
    if (changes.paymentMode !== undefined) {
        base.paymentMode = changes.paymentMode;
    }

    let effectivePaymentSource = base.paymentSource;
    if (changes.paymentSource !== undefined) {
        effectivePaymentSource = normalizePaymentSource(changes.paymentSource);
        if (effectivePaymentSource) {
            base.paymentSource = effectivePaymentSource;
        }
    }

    const userApprovedPaymentSource = normalizePaymentSource(
        changes.paymentSource ?? effectivePaymentSource
    );

    if (userApprovedPaymentSource) {
        await verifyPaymentSourceOwnership(userId, userApprovedPaymentSource);
    }

    const effectiveCategory = pickFieldValue(changes.category) ?? base.category;
    const effectiveSubCategory = pickFieldValue(changes.subCategory) ?? base.subCategory;

    const isRepayment =
        changes.isCreditCardRepayment ?? base.isCreditCardRepayment ?? false;
    const hasCategory =
        effectiveCategory && (effectiveCategory.id || effectiveCategory.value);
    const hasSubCategory =
        effectiveSubCategory && (effectiveSubCategory.id || effectiveSubCategory.value);

    if (base.type === 'DEBIT' && !isRepayment && (!hasCategory || !hasSubCategory)) {
        throw new ApproveError(
            'VALIDATION_ERROR',
            'DEBIT transactions require category and subCategory'
        );
    }

    const userApprovedData = {
        name: changes.name ?? base.name ?? base.merchantNormalized,
        category: effectiveCategory,
        subCategory: effectiveSubCategory,
        paymentSource: userApprovedPaymentSource,
        isCreditCardRepayment:
            changes.isCreditCardRepayment ?? base.isCreditCardRepayment ?? false,
        isPrivate: changes.isPrivate ?? false,
        notes: changes.notes !== undefined ? changes.notes : base.notes
    };

    const reviewFields = { userApprovedData };

    if (changes.date !== undefined) {
        reviewFields.date = base.date;
    }
    if (changes.cycle !== undefined) {
        reviewFields.cycle = base.cycle;
    }
    if (changes.amount !== undefined) {
        reviewFields.amount = base.amount;
    }
    if (changes.paymentMode !== undefined) {
        reviewFields.paymentMode = base.paymentMode;
    }
    if (changes.paymentSource !== undefined && base.paymentSource) {
        reviewFields.paymentSource = base.paymentSource;
    }

    return { userApprovedData, reviewFields };
}

/**
 * Save or update a review document keyed by messageId.
 *
 * - New messageId        → create document
 * - Existing + READY     → update AI-suggested fields only
 * - Existing + APPROVED/AUTO_APPROVED/REJECTED → return as-is (no modification)
 *
 * @param {Object} reviewData - Must include messageId
 * @returns {Object} The created or existing document
 */
const save = async (reviewData) => {
    if (!reviewData?.messageId) {
        throw new Error('reviewData.messageId is required');
    }

    const existing = await TransactionsToReview.findOne({
        messageId: reviewData.messageId
    });

    // ── No document exists → create ──
    if (!existing) {
        const doc = new TransactionsToReview(reviewData);
        await doc.save();
        return doc.toObject();
    }

    // ── Already approved or rejected → return untouched ──
    if (['APPROVED', 'AUTO_APPROVED', 'REJECTED'].includes(existing.status)) {
        return existing.toObject();
    }

    // ── READY_TO_REVIEW → update AI-suggested fields only ──
    const update = {};
    for (const field of AI_UPDATABLE_FIELDS) {
        if (reviewData[field] !== undefined) {
            update[field] = reviewData[field];
        }
    }

    if (Object.keys(update).length === 0) {
        return existing.toObject();
    }

    const updated = await TransactionsToReview.findOneAndUpdate(
        { messageId: reviewData.messageId, status: 'READY_TO_REVIEW' },
        { $set: update },
        { new: true, runValidators: true }
    );

    // Race-condition guard: status changed between find and update
    if (!updated) {
        const current = await TransactionsToReview.findOne({
            messageId: reviewData.messageId
        });
        return current ? current.toObject() : null;
    }

    return updated.toObject();
};

/**
 * Find a review document by its messageId.
 *
 * @param {string} messageId
 * @returns {Object|null} Plain document or null
 */
const findByMessageId = async (messageId) => {
    if (!messageId) {
        throw new Error('messageId is required');
    }

    const doc = await TransactionsToReview.findOne({ messageId }).lean();
    return doc || null;
};

/**
 * Transition the status of a review document.
 *
 * Allowed transitions:
 *   READY_TO_REVIEW → APPROVED
 *   READY_TO_REVIEW → AUTO_APPROVED
 *   READY_TO_REVIEW → REJECTED
 *
 * @param {string} messageId
 * @param {string} newStatus
 * @param {Object} [options]
 * @param {string} [options.approvalActor] - 'AI' or 'MANUAL'
 * @returns {Object} Updated document
 */
const updateStatus = async (messageId, newStatus, { approvalActor } = {}) => {
    if (!messageId) {
        throw new Error('messageId is required');
    }

    if (!['APPROVED', 'AUTO_APPROVED', 'REJECTED', 'READY_TO_REVIEW'].includes(newStatus)) {
        throw new Error(`Invalid status value: ${newStatus}`);
    }

    const doc = await TransactionsToReview.findOne({ messageId });

    if (!doc) {
        throw new Error(
            `TransactionsToReview not found for messageId: ${messageId}`
        );
    }

    const allowed = VALID_TRANSITIONS[doc.status];

    if (!allowed || !allowed.includes(newStatus)) {
        throw new Error(
            `Invalid status transition: ${doc.status} → ${newStatus}`
        );
    }

    doc.status = newStatus;
    if (approvalActor) {
        doc.approvalActor = approvalActor;
    }
    if (['APPROVED', 'AUTO_APPROVED'].includes(newStatus) && !doc.approvedAt) {
        doc.approvedAt = new Date();
    }
    if (newStatus === 'REJECTED' && !doc.rejectedAt) {
        doc.rejectedAt = new Date();
    }
    await doc.save();

    return doc.toObject();
};

function mergeAttachments(existing = [], migrated = []) {
    const byId = new Map();

    for (const attachment of [...existing, ...migrated]) {
        const id = attachment._id ?? attachment.id;
        byId.set(id.toString(), attachment);
    }

    return [...byId.values()];
}

async function persistAttachmentOwnership({
    userId,
    reviewRecord,
    transaction,
    migration
}) {
    if (migration.attachments.length === 0) {
        return {
            review: {
                ...reviewRecord,
                transactionId: transaction._id,
                attachments: reviewRecord.attachments ?? []
            },
            transaction: {
                ...transaction,
                attachments: transaction.attachments ?? []
            }
        };
    }

    const attachmentIds = migration.attachments.map((attachment) => attachment._id);
    const transactionAttachments = mergeAttachments(
        transaction.attachments,
        migration.attachments
    );
    const migratedIdSet = new Set(attachmentIds.map((id) => id.toString()));
    const reviewAttachments = (reviewRecord.attachments ?? []).filter(
        (attachment) => !migratedIdSet.has((attachment._id ?? attachment.id).toString())
    );
    let session;

    try {
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
            const transactionResult = await Transaction.updateOne(
                { _id: transaction._id, userId },
                { $set: { attachments: transactionAttachments } },
                { session, runValidators: true }
            );
            if (transactionResult.matchedCount !== 1) {
                throw new Error('Transaction not found while assigning attachments');
            }

            const reviewResult = await TransactionsToReview.updateOne(
                { _id: reviewRecord._id, userId },
                { $pull: { attachments: { _id: { $in: attachmentIds } } } },
                { session, runValidators: true }
            );
            if (reviewResult.matchedCount !== 1) {
                throw new Error('Review not found while removing attachments');
            }
        });
    } catch (error) {
        try {
            await attachmentService.rollbackAttachmentMigration(migration);
        } catch (rollbackError) {
            console.error('[AttachmentMigration] Mongo rollback compensation failed', {
                userId: userId.toString(),
                reviewId: reviewRecord._id.toString(),
                transactionId: transaction._id.toString(),
                attachmentIds: attachmentIds.map((id) => id.toString()),
                databaseError: error.message,
                rollbackError: rollbackError.message
            });
            error.rollbackError = rollbackError;
        }

        error.code = 'ATTACHMENT_OWNERSHIP_UPDATE_FAILED';
        throw error;
    } finally {
        if (session) {
            await session.endSession();
        }
    }

    return {
        review: {
            ...reviewRecord,
            transactionId: transaction._id,
            attachments: reviewAttachments
        },
        transaction: {
            ...transaction,
            attachments: transactionAttachments
        }
    };
}

/**
 * Shared promotion path for both manual and AI approvals.
 */
const promoteApprovedReview = async (reviewRecord, approvalActor) => {
    const transaction = await transactionService.createFromReview(
        reviewRecord,
        approvalActor
    );
    if (!transaction?._id) {
        throw new Error('Transaction was not created');
    }

    const sourceOwner = {
        type: AttachmentOwnerType.REVIEW,
        id: reviewRecord._id
    };
    const destinationOwner = {
        type: AttachmentOwnerType.TRANSACTION,
        id: transaction._id
    };
    const migration = await attachmentService.moveAttachmentsBetweenOwners({
        userId: reviewRecord.userId,
        sourceOwner,
        destinationOwner,
        attachments: reviewRecord.attachments ?? []
    });

    return persistAttachmentOwnership({
        userId: reviewRecord.userId,
        reviewRecord,
        transaction,
        migration
    });
};

/**
 * Manually approve a review record and create a Transaction.
 *
 * @param {string|ObjectId} userId
 * @param {string} reviewId - TransactionsToReview _id
 * @param {Object} [changes] - Optional user overrides from the review UI
 * @returns {{ review: Object, transaction: Object }}
 */
const approve = async (userId, reviewId, changes = {}) => {
    if (!userId) {
        throw new ApproveError('UNAUTHORIZED', 'userId is required');
    }
    if (!reviewId) {
        throw new ApproveError('VALIDATION_ERROR', 'reviewId is required');
    }

    const doc = await TransactionsToReview.findOne({ _id: reviewId, userId });

    if (!doc) {
        throw new ApproveError('NOT_FOUND', 'Transaction to review not found');
    }

    // Already approved: apply user edits and sync the linked transaction
    if (['APPROVED', 'AUTO_APPROVED'].includes(doc.status)) {
        const existingTxn = await Transaction.findOne({
            messageId: doc.messageId,
            isDeleted: { $ne: true }
        }).lean();

        if (!existingTxn) {
            throw new ApproveError(
                'INVALID_STATE',
                'Review is approved but no transaction exists'
            );
        }

        const hasChanges = Object.keys(changes || {}).length > 0;
        let reviewRecord = doc.toObject();

        if (hasChanges) {
            const { reviewFields } = await prepareManualApprovalUpdate(doc, userId, changes);
            const updatedReview = await TransactionsToReview.findOneAndUpdate(
                { _id: reviewId, userId, status: { $in: ['APPROVED', 'AUTO_APPROVED'] } },
                { $set: { ...reviewFields, approvalActor: 'MANUAL' } },
                { new: true, runValidators: true }
            ).lean();

            if (!updatedReview) {
                throw new ApproveError('NOT_FOUND', 'Transaction to review not found');
            }

            reviewRecord = updatedReview;
        }

        return promoteApprovedReview(
            reviewRecord,
            hasChanges ? 'MANUAL' : doc.approvalActor
        );
    }

    if (doc.status !== 'READY_TO_REVIEW') {
        throw new ApproveError(
            'INVALID_STATE',
            `Cannot approve transaction in status: ${doc.status}`
        );
    }

    const { reviewFields } = await prepareManualApprovalUpdate(doc, userId, changes);

    const approvedAt = doc.approvedAt ?? new Date();
    const $set = {
        status: 'APPROVED',
        approvalActor: 'MANUAL',
        approvedAt,
        ...reviewFields
    };

    const updated = await TransactionsToReview.findOneAndUpdate(
        { _id: reviewId, userId, status: 'READY_TO_REVIEW' },
        {
            $set,
            $unset: { userRejectedData: '' }
        },
        { new: true, runValidators: true }
    ).lean();

    if (!updated) {
        throw new ApproveError('NOT_FOUND', 'Transaction to review not found');
    }

    return promoteApprovedReview(updated, 'MANUAL');
};

/**
 * Reject a review record. Does not create a Transaction.
 *
 * @param {string|ObjectId} userId
 * @param {string} transactionId - TransactionsToReview _id
 * @param {string} [notes] - Optional rejection note
 * @returns {{ review: Object }}
 */
const reject = async (userId, transactionId, notes) => {
    if (!userId) {
        throw new ApproveError('UNAUTHORIZED', 'userId is required');
    }
    if (!transactionId) {
        throw new ApproveError('VALIDATION_ERROR', 'transactionId is required');
    }

    const doc = await TransactionsToReview.findOne({ _id: transactionId, userId });

    if (!doc) {
        throw new ApproveError('NOT_FOUND', 'Transaction to review not found');
    }

    if (doc.status === 'REJECTED') {
        if (notes !== undefined) {
            doc.userRejectedData = { note: notes || undefined };
            await doc.save();
        }
        return { review: doc.toObject() };
    }

    if (['APPROVED', 'AUTO_APPROVED'].includes(doc.status)) {
        throw new ApproveError(
            'INVALID_STATE',
            `Cannot reject transaction in status: ${doc.status}`
        );
    }

    if (doc.status !== 'READY_TO_REVIEW') {
        throw new ApproveError(
            'INVALID_STATE',
            `Cannot reject transaction in status: ${doc.status}`
        );
    }

    const rejectedAt = doc.rejectedAt ?? new Date();
    const userRejectedData = { note: notes ?? undefined };

    const updated = await TransactionsToReview.findOneAndUpdate(
        { _id: transactionId, userId },
        {
            $set: {
                status: 'REJECTED',
                userRejectedData,
                rejectedAt
            },
            $unset: { userApprovedData: '' }
        },
        { new: true, runValidators: true }
    ).lean();

    if (!updated) {
        throw new ApproveError('NOT_FOUND', 'Transaction to review not found');
    }

    return { review: updated };
};

module.exports = {
    save,
    findByMessageId,
    updateStatus,
    promoteApprovedReview,
    approve,
    reject,
    ApproveError
};
