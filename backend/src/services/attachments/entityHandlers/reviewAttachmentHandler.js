const TransactionsToReview = require('../../../models/TransactionsToReview');
const { throwError } = require('../attachmentValidation');

/**
 * Entity handler for entityType = REVIEW (TransactionsToReview documents).
 */

const maxAttachments = 3;
const supportsDirectDelete = true;

function normalizeAttachment(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        storageKey: doc.storageKey,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        size: doc.size,
        uploadedAt: doc.uploadedAt
    };
}

async function assertOwnership(userId, entityId) {
    const exists = await TransactionsToReview.exists({ _id: entityId, userId });
    if (!exists) {
        throwError('NOT_FOUND', 'Transaction to review not found');
    }
}

function storagePathSegment(entityId) {
    return `reviews/${entityId}`;
}

async function getAttachmentCount(entityId) {
    const doc = await TransactionsToReview.findById(entityId, { attachments: 1 }).lean();
    return doc?.attachments?.length ?? 0;
}

async function appendAttachment(entityId, attachment) {
    const updated = await TransactionsToReview.findOneAndUpdate(
        { _id: entityId },
        { $push: { attachments: attachment } },
        { new: true, runValidators: true }
    ).lean();

    if (!updated) {
        throwError('NOT_FOUND', 'Transaction to review not found');
    }

    const stored = updated.attachments.find(
        (item) => item._id.toString() === attachment._id.toString()
    );

    return normalizeAttachment(stored);
}

async function getAttachment(entityId, attachmentId) {
    const doc = await TransactionsToReview.findOne(
        { _id: entityId, 'attachments._id': attachmentId },
        { 'attachments.$': 1 }
    ).lean();

    return normalizeAttachment(doc?.attachments?.[0]);
}

async function removeAttachment(entityId, attachmentId) {
    await TransactionsToReview.updateOne(
        { _id: entityId },
        { $pull: { attachments: { _id: attachmentId } } }
    );
}

module.exports = {
    maxAttachments,
    supportsDirectDelete,
    assertOwnership,
    storagePathSegment,
    getAttachmentCount,
    appendAttachment,
    getAttachment,
    removeAttachment
};
