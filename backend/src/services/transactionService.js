/**
 * transactionService.js
 *
 * Manages the lifecycle of approved Transaction documents.
 * Handles promotion from TransactionsToReview → Transaction
 * and general CRUD operations on transactions.
 */
const Transaction = require('../models/Transaction');
const TransactionsToReview = require('../models/TransactionsToReview');
const UserPreferences = require('../models/UserPreferences');
const googleSheetService = require('./googleSheetService');
const attachmentService = require('./attachments/attachmentService');
const { normalizePaymentSource } = require('../utils/paymentSource.utils');
const {
    TransactionEditError,
    buildTransactionUpdateFromChanges,
    verifyPaymentSourceOwnership,
    pickFieldValue
} = require('../utils/transactionEdit.utils');
const { activeTransactionMatch } = require('../utils/transactionQuery.utils');

/**
 * Backfill bidirectional review ↔ transaction linkage when missing.
 */
async function linkReviewToTransaction(reviewId, txn) {
    if (!reviewId || !txn?._id) {
        return;
    }

    const txnId = txn._id;

    await TransactionsToReview.updateOne(
        { _id: reviewId, transactionId: null },
        { $set: { transactionId: txnId } }
    );

    await Transaction.updateOne(
        { _id: txnId, reviewId: null },
        { $set: { reviewId } }
    );
}

/**
 * Generate a display ID in the format TXN-YYYYMMDD-NNN
 *
 * @param {string} userId - MongoDB user ID
 * @param {Date} date - Transaction date
 * @returns {string} Generated display ID
 */
async function generateDisplayId(userId, date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const prefix = `TXN-${dateStr}-`;

    // Find the highest existing displayId for this user + date prefix
    const last = await Transaction.findOne({
        userId,
        displayId: { $regex: `^${prefix}` }
    })
        .sort({ displayId: -1 })
        .select('displayId')
        .lean();

    const nextNum = last
        ? parseInt(last.displayId.split('-')[2]) + 1
        : 1;

    return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

function resolveEffectiveFields(reviewRecord) {
    const approved = reviewRecord.userApprovedData;
    return {
        name: approved?.name ?? reviewRecord.name ?? reviewRecord.merchantNormalized,
        category: approved?.category ?? reviewRecord.category,
        subCategory: approved?.subCategory ?? reviewRecord.subCategory,
        paymentSource: approved?.paymentSource ?? reviewRecord.paymentSource,
        isCreditCardRepayment:
            approved?.isCreditCardRepayment ?? reviewRecord.isCreditCardRepayment ?? false,
        isPrivate: approved?.isPrivate ?? false,
        notes: approved?.notes !== undefined ? approved.notes : reviewRecord.notes
    };
}

function buildTransactionUpdateFromReview(reviewRecord, approvalActor) {
    const effective = resolveEffectiveFields(reviewRecord);
    return {
        amount: reviewRecord.amount,
        currency: reviewRecord.currency || 'INR',
        type: reviewRecord.type,
        date: reviewRecord.date,
        cycle: reviewRecord.cycle,
        name: effective.name,
        category: effective.category || null,
        subCategory: effective.subCategory || null,
        paymentSource: effective.paymentSource,
        paymentMode: reviewRecord.paymentMode,
        isCreditCardRepayment: effective.isCreditCardRepayment,
        isPrivate: effective.isPrivate,
        notes: effective.notes ?? null,
        approvalActor: approvalActor ?? reviewRecord.approvalActor
    };
}

/**
 * Apply review fields onto an existing Transaction (e.g. user edits on re-approve).
 *
 * @param {Object} reviewRecord - Updated TransactionsToReview plain object
 * @param {string} approvalActor - 'AI' or 'MANUAL'
 * @returns {Object|null} Updated transaction or null if none exists
 */
async function syncFromReview(reviewRecord, approvalActor) {
    const existing = await Transaction.findOne(
        activeTransactionMatch({ messageId: reviewRecord.messageId })
    ).lean();

    if (!existing) {
        return null;
    }

    const updateData = buildTransactionUpdateFromReview(reviewRecord, approvalActor);
    const updated = await Transaction.findOneAndUpdate(
        activeTransactionMatch({ _id: existing._id, userId: reviewRecord.userId }),
        { $set: updateData },
        { new: true, runValidators: true }
    ).lean();

    const result = updated ?? existing;
    await linkReviewToTransaction(reviewRecord._id, result);

    return result;
}

/**
 * Promote a TransactionsToReview record into a Transaction.
 *
 * Maps fields from review schema → transaction schema.
 * Handles idempotency via messageId unique constraint.
 *
 * @param {Object} reviewRecord - The TransactionsToReview document (plain object)
 * @param {string} approvalActor - 'AI' or 'MANUAL'
 * @returns {Object} The created or existing Transaction document
 */
async function createFromReview(reviewRecord, approvalActor) {
    if (!reviewRecord?.messageId) {
        throw new Error('reviewRecord.messageId is required');
    }
    if (!reviewRecord._id) {
        throw new Error('reviewRecord._id is required');
    }

    const reviewId = reviewRecord._id;

    // Idempotency: check if transaction already exists for this messageId
    const existing = await Transaction.findOne(
        activeTransactionMatch({ messageId: reviewRecord.messageId })
    ).lean();

    if (existing) {
        console.log(`[TransactionService] Transaction already exists for messageId=${reviewRecord.messageId}, syncing from review`);
        const synced = await syncFromReview(reviewRecord, approvalActor);
        return synced ?? existing;
    }

    const displayId = await generateDisplayId(reviewRecord.userId, reviewRecord.date);

    // Check if user has Google Sheet configured
    const prefs = await UserPreferences.findOne({ userId: reviewRecord.userId }).lean();
    const hasGoogleSheet = Boolean(prefs?.googleSheetId);

    const effective = {
        ...resolveEffectiveFields(reviewRecord),
        source: reviewRecord.source ?? 'EMAIL'
    };

    const transactionData = {
        userId: reviewRecord.userId,
        amount: reviewRecord.amount,
        currency: reviewRecord.currency || 'INR',
        type: reviewRecord.type,
        date: reviewRecord.date,
        cycle: reviewRecord.cycle,
        name: effective.name,
        merchant: reviewRecord.merchantRaw,
        merchantNormalized: reviewRecord.merchantNormalized,
        category: effective.category || null,
        subCategory: effective.subCategory || null,
        paymentSource: effective.paymentSource,
        paymentMode: reviewRecord.paymentMode,
        isCreditCardRepayment: effective.isCreditCardRepayment,
        isPrivate: effective.isPrivate,
        messageId: reviewRecord.messageId,
        reviewId,
        source: effective.source,
        displayId,
        approvalActor,
        notes: effective.notes ?? null,

        // Google Sheets sync tracking
        sheetSyncStatus: hasGoogleSheet && !effective.isPrivate ? 'PENDING' : null,
        sheetSyncedAt: null,
        sheetSyncError: null
    };

    try {
        const transaction = new Transaction(transactionData);
        await transaction.save();
        console.log(`[TransactionService] Transaction created: ${displayId} (approvalActor=${approvalActor})`);

        const txnObj = transaction.toObject();

        await linkReviewToTransaction(reviewId, txnObj);

        // Trigger Google Sheets sync (fire-and-forget)
        if (txnObj.sheetSyncStatus === 'PENDING') {
            googleSheetService.appendTransaction(reviewRecord.userId, txnObj)
                .catch(err => console.error('[TransactionService] Sheet sync failed:', err.message));
        }

        return txnObj;
    } catch (error) {
        // Handle duplicate messageId race condition
        if (error.code === 11000) {
            console.log(`[TransactionService] Duplicate messageId=${reviewRecord.messageId}, returning existing`);
            const synced = await syncFromReview(reviewRecord, approvalActor);
            if (synced) {
                return synced;
            }
            const existingDoc = await Transaction.findOne(
                activeTransactionMatch({ messageId: reviewRecord.messageId })
            ).lean();
            await linkReviewToTransaction(reviewId, existingDoc);
            return existingDoc;
        }
        throw error;
    }
}

function formatCycle(date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}-${year}`;
}

function isValidCycle(cycle) {
    return /^(0[1-9]|1[0-2])-\d{4}$/.test(cycle);
}

function hasCategoryField(field) {
    return field && (field.id || field.value);
}

/**
 * Create a transaction manually from the UI (no review/email linkage).
 *
 * @param {string|ObjectId} userId
 * @param {Object} input - CreateTransactionInput shape
 * @returns {Object} Created transaction document
 */
async function createManual(userId, input = {}) {
    if (!userId) {
        throw new TransactionEditError('UNAUTHORIZED', 'userId is required');
    }

    const name = (input.name || '').trim();
    if (!name) {
        throw new TransactionEditError('VALIDATION_ERROR', 'name is required');
    }

    const type = input.type;
    if (!type || !['DEBIT', 'CREDIT'].includes(type)) {
        throw new TransactionEditError('VALIDATION_ERROR', 'type must be DEBIT or CREDIT');
    }

    const amount = input.amount;
    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
        throw new TransactionEditError('VALIDATION_ERROR', 'amount is required');
    }

    if (!input.date) {
        throw new TransactionEditError('VALIDATION_ERROR', 'date is required');
    }

    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
        throw new TransactionEditError('VALIDATION_ERROR', 'date is invalid');
    }

    if (!input.paymentMode) {
        throw new TransactionEditError('VALIDATION_ERROR', 'paymentMode is required');
    }

    const paymentSource = normalizePaymentSource(input.paymentSource);
    if (!paymentSource) {
        throw new TransactionEditError('VALIDATION_ERROR', 'paymentSource is required');
    }

    await verifyPaymentSourceOwnership(userId, paymentSource);

    const category = pickFieldValue(input.category) ?? null;
    const subCategory = pickFieldValue(input.subCategory) ?? null;
    const isRepayment = input.isCreditCardRepayment ?? false;
    const isPrivate = input.isPrivate ?? false;

    if (type === 'DEBIT' && !isRepayment && (!hasCategoryField(category) || !hasCategoryField(subCategory))) {
        throw new TransactionEditError(
            'VALIDATION_ERROR',
            'DEBIT transactions require category and subCategory'
        );
    }

    const cycle = input.cycle && isValidCycle(input.cycle)
        ? input.cycle
        : formatCycle(date);

    const displayId = await generateDisplayId(userId, date);

    const prefs = await UserPreferences.findOne({ userId }).lean();
    const hasGoogleSheet = Boolean(prefs?.googleSheetId);

    const merchantValue = (input.merchant || '').trim() || name;

    const transactionData = {
        userId,
        amount,
        currency: input.currency || 'INR',
        type,
        date,
        cycle,
        name,
        merchant: merchantValue,
        merchantNormalized: merchantValue,
        category,
        subCategory,
        paymentSource,
        paymentMode: input.paymentMode,
        isCreditCardRepayment: isRepayment,
        isPrivate,
        source: 'MANUAL',
        messageId: `manual:${displayId}`,
        displayId,
        approvalActor: 'MANUAL',
        notes: input.notes ?? null,
        sheetSyncStatus: hasGoogleSheet && !isPrivate ? 'PENDING' : null,
        sheetSyncedAt: null,
        sheetSyncError: null
    };

    const transaction = new Transaction(transactionData);
    await transaction.save();
    console.log(`[TransactionService] Manual transaction created: ${displayId}`);

    const txnObj = transaction.toObject();

    if (txnObj.sheetSyncStatus === 'PENDING') {
        googleSheetService.appendTransaction(userId, txnObj)
            .catch(err => console.error('[TransactionService] Sheet sync failed:', err.message));
    }

    return txnObj;
}

/**
 * Update an existing transaction.
 * Scoped by both userId and transactionId to prevent IDOR.
 *
 * @param {string|ObjectId} userId - Owner of the transaction (required)
 * @param {string} transactionId - MongoDB Transaction _id
 * @param {Object} updateData - Fields to update
 * @returns {Object} Updated transaction document
 */
async function update(userId, transactionId, updateData, deleteAttachmentIds = []) {
    if (!userId) {
        throw new Error('userId is required');
    }
    if (!transactionId) {
        throw new Error('transactionId is required');
    }

    const updateOperation = { $set: updateData };
    if (deleteAttachmentIds.length > 0) {
        updateOperation.$pull = {
            attachments: { _id: { $in: deleteAttachmentIds } }
        };
    }

    const transaction = await Transaction.findOneAndUpdate(
        activeTransactionMatch({ _id: transactionId, userId }),
        updateOperation,
        { new: true, runValidators: true }
    );

    if (!transaction) {
        const err = new Error(`Transaction not found: ${transactionId}`);
        err.code = 'NOT_FOUND';
        throw err;
    }

    return transaction.toObject();
}

/**
 * Edit an existing approved transaction from the transactions list UI.
 *
 * @param {string|ObjectId} userId
 * @param {string} transactionId
 * @param {Object} changes
 * @returns {Object} Updated transaction document
 */
async function editTransaction(
    userId,
    transactionId,
    changes = {},
    deleteAttachments = []
) {
    if (!userId) {
        throw new TransactionEditError('UNAUTHORIZED', 'userId is required');
    }
    if (!transactionId) {
        throw new TransactionEditError('VALIDATION_ERROR', 'transactionId is required');
    }

    const existing = await Transaction.findOne(
        activeTransactionMatch({ _id: transactionId, userId })
    );
    if (!existing) {
        throw new TransactionEditError('NOT_FOUND', 'Transaction not found');
    }

    const updateData = await buildTransactionUpdateFromChanges(existing, userId, changes);
    const deleteAttachmentIds = [...new Set(
        (deleteAttachments ?? []).map((attachmentId) => attachmentId.toString())
    )];
    const attachmentsById = new Map(
        (existing.attachments ?? []).map((attachment) => [
            attachment._id.toString(),
            attachment
        ])
    );
    const attachmentsToDelete = deleteAttachmentIds.map((attachmentId) => (
        attachmentsById.get(attachmentId)
    ));

    if (attachmentsToDelete.some((attachment) => !attachment)) {
        throw new TransactionEditError(
            'VALIDATION_ERROR',
            'Every attachment selected for deletion must belong to the transaction'
        );
    }

    if (Object.keys(updateData).length === 0 && deleteAttachmentIds.length === 0) {
        return existing.toObject();
    }

    if (existing.approvalActor === 'AI') {
        updateData.approvalActor = 'MANUAL';

        if (existing.reviewId) {
            await TransactionsToReview.updateOne(
                { _id: existing.reviewId, userId },
                { $set: { approvalActor: 'MANUAL' } }
            );
        }
    }

    const deletionReceipt = await attachmentService.stageAttachmentsForDeletion(
        attachmentsToDelete
    );

    try {
        const updated = await update(
            userId,
            transactionId,
            updateData,
            deleteAttachmentIds
        );
        await attachmentService.finalizeStagedAttachmentDeletion(deletionReceipt);
        return updated;
    } catch (error) {
        try {
            await attachmentService.rollbackStagedAttachmentDeletion(deletionReceipt);
        } catch (rollbackError) {
            console.error('[AttachmentDeletion] Transaction update rollback failed', {
                userId: userId.toString(),
                transactionId: transactionId.toString(),
                attachmentIds: deleteAttachmentIds,
                updateError: error.message,
                rollbackError: rollbackError.message
            });
            error.rollbackError = rollbackError;
        }
        throw error;
    }
}

/**
 * Delete a transaction scoped to the owning user.
 *
 * @param {string|ObjectId} userId
 * @param {string} transactionId
 * @returns {Object} Deleted transaction document
 */
async function deleteTransaction(userId, transactionId) {
    if (!userId) {
        throw new TransactionEditError('UNAUTHORIZED', 'userId is required');
    }
    if (!transactionId) {
        throw new TransactionEditError('VALIDATION_ERROR', 'transactionId is required');
    }

    const existing = await Transaction.findOne(
        activeTransactionMatch({ _id: transactionId, userId })
    ).lean();
    if (!existing) {
        throw new TransactionEditError('NOT_FOUND', 'Transaction not found');
    }

    if (existing.reviewId) {
        await TransactionsToReview.updateOne(
            { _id: existing.reviewId, userId },
            { $set: { transactionId: null } }
        );
    }

    await Transaction.findOneAndUpdate(
        activeTransactionMatch({ _id: transactionId, userId }),
        { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    return existing;
}

/**
 * Confirm a transaction document exists in the transactions collection for this user.
 *
 * @param {string|ObjectId} userId
 * @param {Object} transaction - Plain transaction object from createFromReview
 * @returns {Object} The persisted transaction document
 */
async function assertTransactionPersisted(userId, transaction) {
    const txnId = transaction?._id;
    if (!txnId) {
        throw new Error('Transaction was not created');
    }

    const persisted = await Transaction.findOne(
        activeTransactionMatch({ _id: txnId, userId })
    ).lean();
    if (!persisted) {
        throw new Error(
            `Transaction ${txnId} was not found in the transactions collection`
        );
    }

    return persisted;
}

module.exports = {
    createFromReview,
    createManual,
    syncFromReview,
    assertTransactionPersisted,
    generateDisplayId,
    update,
    editTransaction,
    deleteTransaction,
    TransactionEditError
};
