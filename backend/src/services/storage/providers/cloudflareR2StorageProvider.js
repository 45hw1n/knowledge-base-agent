const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
    CopyObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../../../config');

/**
 * Cloudflare R2 storage provider (S3-compatible API).
 *
 * This is the ONLY file in the codebase allowed to reference the AWS SDK /
 * Cloudflare-specific concepts. Everything else must go through storageService.
 */

let client = null;

function getClient() {
    if (client) return client;

    client = new S3Client({
        region: 'auto',
        endpoint: config.storage.endpoint,
        credentials: {
            accessKeyId: config.storage.accessKeyId,
            secretAccessKey: config.storage.secretAccessKey
        }
    });

    return client;
}

async function uploadObject({ storageKey, contentType, body }) {
    await getClient().send(new PutObjectCommand({
        Bucket: config.storage.bucketName,
        Key: storageKey,
        ContentType: contentType,
        Body: body
    }));
}

async function getSignedDownloadUrl({ storageKey, expiresInSeconds }) {
    const command = new GetObjectCommand({
        Bucket: config.storage.bucketName,
        Key: storageKey
    });

    return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

async function objectExists({ storageKey }) {
    try {
        await getClient().send(new HeadObjectCommand({
            Bucket: config.storage.bucketName,
            Key: storageKey
        }));
        return true;
    } catch (error) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            return false;
        }
        throw error;
    }
}

async function deleteObject({ storageKey }) {
    await getClient().send(new DeleteObjectCommand({
        Bucket: config.storage.bucketName,
        Key: storageKey
    }));
}

async function copyObject({ sourceKey, destinationKey }) {
    await getClient().send(new CopyObjectCommand({
        Bucket: config.storage.bucketName,
        CopySource: `${config.storage.bucketName}/${sourceKey}`,
        Key: destinationKey
    }));
}

module.exports = {
    uploadObject,
    getSignedDownloadUrl,
    objectExists,
    deleteObject,
    copyObject
};
