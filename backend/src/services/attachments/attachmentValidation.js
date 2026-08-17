/**
 * Shared, entity-agnostic file validation rules. Per-entity limits (e.g. max
 * attachment count) live in each entity handler instead — this module only
 * covers what a "valid file" looks like in general.
 */

const ALLOWED_MIME_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'application/pdf': 'pdf'
};

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const throwError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    throw error;
};

function getExtensionForMimeType(mimeType) {
    return ALLOWED_MIME_TYPES[mimeType] ?? null;
}

/**
 * Validates a single file's declared mimeType/size and returns the storage
 * extension to use for it. Throws a VALIDATION_ERROR on any violation.
 *
 * @param {{ fileName: string, mimeType: string, size: number }} file
 * @param {{ maxFileSizeBytes?: number }} [options]
 * @returns {string} extension (without the leading dot)
 */
function validateFile(file, { maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES } = {}) {
    if (!file || !file.fileName || !file.mimeType || !file.size) {
        throwError('VALIDATION_ERROR', 'fileName, mimeType and size are required for every file');
    }

    const extension = getExtensionForMimeType(file.mimeType);
    if (!extension) {
        throwError('VALIDATION_ERROR', `Unsupported file type: ${file.mimeType}`);
    }

    if (file.size > maxFileSizeBytes) {
        const maxMb = maxFileSizeBytes / (1024 * 1024);
        throwError('VALIDATION_ERROR', `"${file.fileName}" exceeds the ${maxMb}MB size limit`);
    }

    return extension;
}

module.exports = {
    ALLOWED_MIME_TYPES,
    DEFAULT_MAX_FILE_SIZE_BYTES,
    getExtensionForMimeType,
    validateFile,
    throwError
};
