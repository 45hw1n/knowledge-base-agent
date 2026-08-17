const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const storageService = require('../storage/storageService');
const { getEntityHandler } = require('./entityHandlers');
const {
    DEFAULT_MAX_FILE_SIZE_BYTES,
    getExtensionForMimeType,
    throwError
} = require('./attachmentValidation');
const { buildStorageKey } = require('./attachmentOwnership');
const { bufferStream, drainStream } = require('./streamUtils');

function fileResult(attachmentId, fileName, status, errorCode = null) {
    return { attachmentId: attachmentId.toString(), fileName, status, errorCode };
}

function attachmentMetadata(attachment, storageKey = attachment.storageKey) {
    const attachmentId = attachment._id ?? attachment.id;
    return {
        _id: attachmentId,
        storageKey,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        uploadedAt: attachment.uploadedAt
    };
}

function logMigrationFailure(message, context, error) {
    console.error('[AttachmentMigration]', {
        message,
        ...context,
        error: error.message,
        phase: error.phase ?? 'UNKNOWN',
        failedPairs: error.failedPairs ?? [],
        compensationFailures: error.compensationFailures ?? []
    });
}

/**
 * Backend-owned upload: for every incoming file, validate it, upload it to
 * Cloudflare R2, and persist its metadata into the owning entity — all in
 * one request. The browser never talks to Cloudflare directly and no
 * upload-lifecycle record is kept; a failed file simply never gets
 * metadata persisted.
 *
 * @param {string|ObjectId} userId
 * @param {string} entityType - AttachmentEntityType
 * @param {string|ObjectId} entityId
 * @param {Array<Promise<{ filename: string, mimetype: string, createReadStream: Function }>>} files
 * @returns {Promise<{ entityType: string, entityId: string, status: string, files: Array<Object> }>}
 */
async function uploadAttachments(userId, entityType, entityId, files) {
    if (!userId) throwError('UNAUTHORIZED', 'userId is required');
    if (!entityId) throwError('VALIDATION_ERROR', 'entityId is required');
    if (!files || files.length === 0) {
        throwError('VALIDATION_ERROR', 'At least one file is required');
    }

    const handler = getEntityHandler(entityType);
    await handler.assertOwnership(userId, entityId);

    const existingCount = await handler.getAttachmentCount(entityId);
    const availableSlots = Math.max(handler.maxAttachments - existingCount, 0);

    const results = [];
    const uploadedAttachments = [];

    for (let i = 0; i < files.length; i++) {
        const upload = await files[i];
        const attachmentId = new mongoose.Types.ObjectId();
        const fileName = upload.filename;

        if (i >= availableSlots) {
            await drainStream(upload.createReadStream());
            results.push(fileResult(attachmentId, fileName, 'FAILED', 'ATTACHMENT_LIMIT_EXCEEDED'));
            continue;
        }

        const extension = getExtensionForMimeType(upload.mimetype);
        if (!extension) {
            await drainStream(upload.createReadStream());
            results.push(fileResult(attachmentId, fileName, 'FAILED', 'UNSUPPORTED_FILE_TYPE'));
            continue;
        }

        let buffer;
        try {
            buffer = await bufferStream(upload.createReadStream(), DEFAULT_MAX_FILE_SIZE_BYTES);
        } catch (error) {
            results.push(fileResult(attachmentId, fileName, 'FAILED', 'FILE_TOO_LARGE'));
            continue;
        }

        const storageKey = buildStorageKey({
            userId,
            owner: { type: entityType, id: entityId },
            attachmentId,
            extension
        });

        try {
            await storageService.uploadObject({ storageKey, contentType: upload.mimetype, body: buffer });
        } catch (error) {
            results.push(fileResult(attachmentId, fileName, 'FAILED', 'UPLOAD_FAILED'));
            continue;
        }

        const storedAttachment = await handler.appendAttachment(entityId, {
            _id: attachmentId,
            storageKey,
            fileName,
            mimeType: upload.mimetype,
            size: buffer.length,
            uploadedAt: new Date()
        });
        uploadedAttachments.push(storedAttachment);

        results.push(fileResult(attachmentId, fileName, 'SUCCESS'));
    }

    const successCount = results.filter((result) => result.status === 'SUCCESS').length;
    const status = successCount === results.length
        ? 'SUCCESS'
        : successCount === 0
            ? 'FAILURE'
            : 'PARTIAL';

    return {
        entityType,
        entityId,
        status,
        files: results,
        attachments: uploadedAttachments
    };
}

/**
 * @param {string|ObjectId} userId
 * @param {string} entityType
 * @param {string|ObjectId} entityId
 * @param {string} attachmentId
 * @returns {Promise<boolean>}
 */
async function deleteAttachment(userId, entityType, entityId, attachmentId) {
    if (!userId) throwError('UNAUTHORIZED', 'userId is required');

    const handler = getEntityHandler(entityType);
    await handler.assertOwnership(userId, entityId);
    if (!handler.supportsDirectDelete) {
        throwError(
            'NOT_IMPLEMENTED',
            `Direct attachment deletion is not supported for entityType: ${entityType}`
        );
    }

    const attachment = await handler.getAttachment(entityId, attachmentId);
    if (!attachment) {
        throwError('NOT_FOUND', 'Attachment not found');
    }

    await storageService.deleteObject({ storageKey: attachment.storageKey });
    await handler.removeAttachment(entityId, attachmentId);

    return true;
}

/**
 * Generates a signed download URL on demand. Never called as a side effect
 * of listing/querying an entity — only when a file is actually opened.
 *
 * @param {string|ObjectId} userId
 * @param {string} entityType
 * @param {string|ObjectId} entityId
 * @param {string} attachmentId
 * @returns {Promise<string>}
 */
async function getAttachmentDownloadUrl(userId, entityType, entityId, attachmentId) {
    if (!userId) throwError('UNAUTHORIZED', 'userId is required');

    const handler = getEntityHandler(entityType);
    await handler.assertOwnership(userId, entityId);

    const attachment = await handler.getAttachment(entityId, attachmentId);
    if (!attachment) {
        throwError('NOT_FOUND', 'Attachment not found');
    }

    return storageService.getSignedDownloadUrl({ storageKey: attachment.storageKey });
}

/**
 * Physically moves attachment objects between storage owners and returns a
 * receipt containing updated metadata. This function deliberately performs
 * no entity reads or writes; callers own database persistence.
 */
async function moveAttachmentsBetweenOwners({
    userId,
    sourceOwner,
    destinationOwner,
    attachments = []
}) {
    if (!userId) throwError('UNAUTHORIZED', 'userId is required');
    if (!sourceOwner || !destinationOwner) {
        throwError('VALIDATION_ERROR', 'sourceOwner and destinationOwner are required');
    }
    if (attachments.length === 0) {
        return {
            attachments: [],
            sourceAttachments: [],
            pairs: [],
            sourceOwner,
            destinationOwner
        };
    }

    let sourceAttachments;
    let migratedAttachments;
    let pairs;

    try {
        sourceAttachments = attachments.map((attachment) => attachmentMetadata(attachment));
        migratedAttachments = sourceAttachments.map((attachment) => {
            const extension = getExtensionForMimeType(attachment.mimeType);
            if (!extension) {
                throwError(
                    'ATTACHMENT_MOVE_FAILED',
                    `Unsupported attachment MIME type: ${attachment.mimeType}`
                );
            }

            const destinationKey = buildStorageKey({
                userId,
                owner: destinationOwner,
                attachmentId: attachment._id,
                extension
            });
            return attachmentMetadata(attachment, destinationKey);
        });
        pairs = sourceAttachments.map((attachment, index) => ({
            attachmentId: attachment._id.toString(),
            sourceKey: attachment.storageKey,
            destinationKey: migratedAttachments[index].storageKey
        }));

        await storageService.moveObjects(pairs);
    } catch (error) {
        logMigrationFailure('Attachment storage move failed', {
            userId: userId.toString(),
            sourceOwner,
            destinationOwner,
            attachmentIds: (sourceAttachments ?? attachments)
                .map((attachment) => (attachment._id ?? attachment.id)?.toString())
        }, error);
        error.code = 'ATTACHMENT_MOVE_FAILED';
        throw error;
    }

    return {
        attachments: migratedAttachments,
        sourceAttachments,
        pairs,
        sourceOwner,
        destinationOwner
    };
}

async function rollbackAttachmentMigration({ pairs = [], sourceOwner, destinationOwner }) {
    if (pairs.length === 0) return;

    const reversePairs = pairs.map(({ attachmentId, sourceKey, destinationKey }) => ({
        attachmentId,
        sourceKey: destinationKey,
        destinationKey: sourceKey
    }));

    try {
        await storageService.moveObjects(reversePairs);
    } catch (error) {
        logMigrationFailure('Attachment storage rollback failed', {
            sourceOwner: destinationOwner,
            destinationOwner: sourceOwner,
            attachmentIds: pairs.map(({ attachmentId }) => attachmentId)
        }, error);
        error.code = 'ATTACHMENT_ROLLBACK_FAILED';
        throw error;
    }
}

function attachmentDeletionError(message, phase, failures, compensationFailures = []) {
    const error = new Error(message);
    error.code = 'ATTACHMENT_DELETE_FAILED';
    error.phase = phase;
    error.failures = failures;
    error.compensationFailures = compensationFailures;
    return error;
}

async function deleteStorageKeys(keys) {
    const results = await Promise.allSettled(
        keys.map((storageKey) => storageService.deleteObject({ storageKey }))
    );
    return results.flatMap((result, index) => (
        result.status === 'rejected'
            ? [{ storageKey: keys[index], error: result.reason?.message }]
            : []
    ));
}

function logDeletionFailure(message, receipt, error) {
    console.error('[AttachmentDeletion]', {
        message,
        phase: error.phase ?? 'UNKNOWN',
        attachmentIds: receipt.entries.map(({ attachmentId }) => attachmentId),
        failures: error.failures ?? [],
        compensationFailures: error.compensationFailures ?? []
    });
}

/**
 * Creates recoverable storage backups, then deletes the original objects.
 * Database ownership remains the caller's responsibility.
 */
async function stageAttachmentsForDeletion(attachments = []) {
    const receipt = {
        entries: attachments.map((attachment) => ({
            attachmentId: (attachment._id ?? attachment.id).toString(),
            sourceKey: attachment.storageKey,
            backupKey: `${attachment.storageKey}.pending-delete.${randomUUID()}`
        }))
    };
    if (receipt.entries.length === 0) return receipt;

    const backupResults = await Promise.allSettled(
        receipt.entries.map(({ sourceKey, backupKey }) => (
            storageService.copyObject({ sourceKey, destinationKey: backupKey })
        ))
    );
    const backedUpEntries = receipt.entries.filter(
        (_, index) => backupResults[index].status === 'fulfilled'
    );
    const backupFailures = receipt.entries.flatMap((entry, index) => (
        backupResults[index].status === 'rejected'
            ? [{ ...entry, error: backupResults[index].reason?.message }]
            : []
    ));

    if (backupFailures.length > 0) {
        const compensationFailures = await deleteStorageKeys(
            backedUpEntries.map(({ backupKey }) => backupKey)
        );
        const error = attachmentDeletionError(
            'Unable to prepare attachment deletion',
            'BACKUP',
            backupFailures,
            compensationFailures
        );
        logDeletionFailure('Attachment backup failed', receipt, error);
        throw error;
    }

    const deleteResults = await Promise.allSettled(
        receipt.entries.map(({ sourceKey }) => (
            storageService.deleteObject({ storageKey: sourceKey })
        ))
    );
    const deletedEntries = receipt.entries.filter(
        (_, index) => deleteResults[index].status === 'fulfilled'
    );
    const deleteFailures = receipt.entries.flatMap((entry, index) => (
        deleteResults[index].status === 'rejected'
            ? [{ ...entry, error: deleteResults[index].reason?.message }]
            : []
    ));

    if (deleteFailures.length > 0) {
        const restoreResults = await Promise.allSettled(
            deletedEntries.map(({ sourceKey, backupKey }) => (
                storageService.copyObject({ sourceKey: backupKey, destinationKey: sourceKey })
            ))
        );
        const restoreFailures = deletedEntries.flatMap((entry, index) => (
            restoreResults[index].status === 'rejected'
                ? [{ ...entry, error: restoreResults[index].reason?.message }]
                : []
        ));
        const cleanupFailures = restoreFailures.length === 0
            ? await deleteStorageKeys(receipt.entries.map(({ backupKey }) => backupKey))
            : [];
        const error = attachmentDeletionError(
            'Unable to delete every attachment object',
            'DELETE_SOURCE',
            deleteFailures,
            [...restoreFailures, ...cleanupFailures]
        );
        logDeletionFailure('Attachment deletion failed', receipt, error);
        throw error;
    }

    return receipt;
}

async function rollbackStagedAttachmentDeletion(receipt) {
    if (!receipt?.entries?.length) return;

    const restoreResults = await Promise.allSettled(
        receipt.entries.map(({ sourceKey, backupKey }) => (
            storageService.copyObject({ sourceKey: backupKey, destinationKey: sourceKey })
        ))
    );
    const restoreFailures = receipt.entries.flatMap((entry, index) => (
        restoreResults[index].status === 'rejected'
            ? [{ ...entry, error: restoreResults[index].reason?.message }]
            : []
    ));
    if (restoreFailures.length > 0) {
        const error = attachmentDeletionError(
            'Unable to restore attachment objects after transaction update failure',
            'ROLLBACK',
            restoreFailures
        );
        logDeletionFailure('Attachment deletion rollback failed', receipt, error);
        throw error;
    }

    const cleanupFailures = await deleteStorageKeys(
        receipt.entries.map(({ backupKey }) => backupKey)
    );
    if (cleanupFailures.length > 0) {
        console.error('[AttachmentDeletion]', {
            message: 'Attachment rollback restored originals but backup cleanup failed',
            phase: 'ROLLBACK_CLEANUP',
            attachmentIds: receipt.entries.map(({ attachmentId }) => attachmentId),
            failures: cleanupFailures
        });
    }
}

async function finalizeStagedAttachmentDeletion(receipt) {
    if (!receipt?.entries?.length) return;

    const failures = await deleteStorageKeys(
        receipt.entries.map(({ backupKey }) => backupKey)
    );
    if (failures.length > 0) {
        console.error('[AttachmentDeletion]', {
            message: 'Transaction updated but attachment backup cleanup failed',
            phase: 'FINALIZE',
            attachmentIds: receipt.entries.map(({ attachmentId }) => attachmentId),
            failures
        });
    }
}

module.exports = {
    uploadAttachments,
    deleteAttachment,
    getAttachmentDownloadUrl,
    moveAttachmentsBetweenOwners,
    rollbackAttachmentMigration,
    stageAttachmentsForDeletion,
    rollbackStagedAttachmentDeletion,
    finalizeStagedAttachmentDeletion
};
