const AttachmentOwnerType = Object.freeze({
    REVIEW: 'REVIEW',
    TRANSACTION: 'TRANSACTION'
});

const OWNER_PATH_BUILDERS = {
    [AttachmentOwnerType.REVIEW]: (ownerId) => `reviews/${ownerId}`,
    [AttachmentOwnerType.TRANSACTION]: (ownerId) => `transactions/${ownerId}`
};

function buildOwnerPath(owner) {
    if (!owner?.type || !owner?.id) {
        throw new Error('Attachment owner type and id are required');
    }

    const buildPath = OWNER_PATH_BUILDERS[owner.type];
    if (!buildPath) {
        throw new Error(`Unsupported attachment owner type: ${owner.type}`);
    }

    return buildPath(owner.id);
}

function buildStorageKey({ userId, owner, attachmentId, extension }) {
    if (!userId || !attachmentId || !extension) {
        throw new Error('userId, attachmentId and extension are required');
    }

    return `users/${userId}/${buildOwnerPath(owner)}/${attachmentId}.${extension}`;
}

module.exports = {
    AttachmentOwnerType,
    buildOwnerPath,
    buildStorageKey
};
