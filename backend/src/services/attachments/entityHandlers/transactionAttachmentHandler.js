const Transaction = require('../../../models/Transaction');
const { activeTransactionMatch } = require('../../../utils/transactionQuery.utils');
const { throwError } = require('../attachmentValidation');

const maxAttachments = 3;
const supportsDirectDelete = false;

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

function storagePathSegment(entityId) {
    return `transactions/${entityId}`;
}

async function assertOwnership(userId, entityId) {
    const exists = await Transaction.exists(
        activeTransactionMatch({ _id: entityId, userId })
    );
    if (!exists) {
        throwError('NOT_FOUND', 'Transaction not found');
    }
}

async function getAttachment(entityId, attachmentId) {
    const doc = await Transaction.findOne(
        activeTransactionMatch({
            _id: entityId,
            'attachments._id': attachmentId
        }),
        { 'attachments.$': 1 }
    ).lean();

    return normalizeAttachment(doc?.attachments?.[0]);
}

async function getAttachmentCount(entityId) {
    const doc = await Transaction.findOne(
        activeTransactionMatch({ _id: entityId }),
        { attachments: 1 }
    ).lean();
    return doc?.attachments?.length ?? 0;
}

async function appendAttachment(entityId, attachment) {
    const updated = await Transaction.findOneAndUpdate(
        activeTransactionMatch({ _id: entityId }),
        { $push: { attachments: attachment } },
        { new: true, runValidators: true }
    ).lean();

    if (!updated) {
        throwError('NOT_FOUND', 'Transaction not found');
    }

    const stored = updated.attachments.find(
        (item) => item._id.toString() === attachment._id.toString()
    );
    return normalizeAttachment(stored);
}

function mutationNotImplemented() {
    throwError(
        'NOT_IMPLEMENTED',
        'Transaction attachment CRUD is not implemented'
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
    removeAttachment: mutationNotImplemented
};
