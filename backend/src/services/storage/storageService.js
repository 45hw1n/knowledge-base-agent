const config = require('../../config');

/**
 * Provider-agnostic storage API. Business code must only ever import this
 * module — never a provider (e.g. Cloudflare R2) directly.
 *
 * Adding a new provider (e.g. AWS S3) means adding a new file under
 * ./providers and registering it in PROVIDERS below; no business code changes.
 */
const PROVIDERS = {
    'cloudflare-r2': () => require('./providers/cloudflareR2StorageProvider')
};

const DEFAULT_DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

function getProvider() {
    const loadProvider = PROVIDERS[config.storage.provider];

    if (!loadProvider) {
        throw new Error(`Unsupported storage provider: ${config.storage.provider}`);
    }

    return loadProvider();
}

/**
 * Uploads a file's bytes directly to storage. The backend is the only
 * writer — the browser never talks to Cloudflare R2 itself.
 *
 * @param {{ storageKey: string, contentType: string, body: Buffer }} params
 * @returns {Promise<void>}
 */
async function uploadObject({ storageKey, contentType, body }) {
    return getProvider().uploadObject({ storageKey, contentType, body });
}

/**
 * @param {{ storageKey: string, expiresInSeconds?: number }} params
 * @returns {Promise<string>}
 */
async function getSignedDownloadUrl({ storageKey, expiresInSeconds = DEFAULT_DOWNLOAD_URL_TTL_SECONDS }) {
    return getProvider().getSignedDownloadUrl({ storageKey, expiresInSeconds });
}

/**
 * @param {{ storageKey: string }} params
 * @returns {Promise<boolean>}
 */
async function objectExists({ storageKey }) {
    return getProvider().objectExists({ storageKey });
}

/**
 * @param {{ storageKey: string }} params
 */
async function deleteObject({ storageKey }) {
    return getProvider().deleteObject({ storageKey });
}

async function copyObject({ sourceKey, destinationKey }) {
    return getProvider().copyObject({ sourceKey, destinationKey });
}

function storageMoveError(message, phase, failedPairs, compensationFailures = []) {
    const error = new Error(message);
    error.code = 'STORAGE_MOVE_FAILED';
    error.phase = phase;
    error.failedPairs = failedPairs;
    error.compensationFailures = compensationFailures;
    return error;
}

async function deleteKeys(storageKeys) {
    const results = await Promise.allSettled(
        storageKeys.map((storageKey) => deleteObject({ storageKey }))
    );

    return results.flatMap((result, index) => (
        result.status === 'rejected'
            ? [{ storageKey: storageKeys[index], error: result.reason?.message }]
            : []
    ));
}

/**
 * Best-effort atomic batch move for S3-compatible storage.
 *
 * All destinations are copied before any source is deleted. Failed copies
 * are cleaned up. Failed source deletion triggers a compensating restore of
 * already-deleted sources before destination copies are removed.
 *
 * @param {Array<{ sourceKey: string, destinationKey: string }>} pairs
 * @returns {Promise<Array<{ sourceKey: string, destinationKey: string, success: boolean, error?: string }>>}
 */
async function moveObjects(pairs) {
    if (!pairs || pairs.length === 0) return [];

    const copyResults = await Promise.allSettled(
        pairs.map(({ sourceKey, destinationKey }) => copyObject({ sourceKey, destinationKey }))
    );
    const copiedPairs = pairs.filter((_, index) => copyResults[index].status === 'fulfilled');
    const failedCopies = pairs.flatMap((pair, index) => (
        copyResults[index].status === 'rejected'
            ? [{ ...pair, error: copyResults[index].reason?.message }]
            : []
    ));

    if (failedCopies.length > 0) {
        const compensationFailures = await deleteKeys(
            copiedPairs.map(({ destinationKey }) => destinationKey)
        );
        throw storageMoveError(
            'One or more storage objects could not be copied',
            'COPY',
            failedCopies,
            compensationFailures
        );
    }

    const deleteResults = await Promise.allSettled(
        pairs.map(({ sourceKey }) => deleteObject({ storageKey: sourceKey }))
    );
    const deletedPairs = pairs.filter((_, index) => deleteResults[index].status === 'fulfilled');
    const failedDeletes = pairs.flatMap((pair, index) => (
        deleteResults[index].status === 'rejected'
            ? [{ ...pair, error: deleteResults[index].reason?.message }]
            : []
    ));

    if (failedDeletes.length > 0) {
        const restoreResults = await Promise.allSettled(
            deletedPairs.map(({ sourceKey, destinationKey }) => (
                copyObject({ sourceKey: destinationKey, destinationKey: sourceKey })
            ))
        );
        const restoreFailures = deletedPairs.flatMap((pair, index) => (
            restoreResults[index].status === 'rejected'
                ? [{ ...pair, error: restoreResults[index].reason?.message }]
                : []
        ));
        const cleanupFailures = restoreFailures.length === 0
            ? await deleteKeys(pairs.map(({ destinationKey }) => destinationKey))
            : [];

        throw storageMoveError(
            'One or more storage source objects could not be deleted',
            'DELETE_SOURCE',
            failedDeletes,
            [...restoreFailures, ...cleanupFailures]
        );
    }

    return pairs.map((pair) => ({ ...pair, success: true }));
}

module.exports = {
    uploadObject,
    getSignedDownloadUrl,
    objectExists,
    deleteObject,
    copyObject,
    moveObjects,
    DEFAULT_DOWNLOAD_URL_TTL_SECONDS
};
