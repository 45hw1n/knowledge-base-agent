const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

// Validate key
if (!process.env.EMAIL_ENCRYPTION_KEY) {
    throw new Error('EMAIL_ENCRYPTION_KEY is not defined in environment');
}

const KEY = Buffer.from(process.env.EMAIL_ENCRYPTION_KEY, 'hex');

if (KEY.length !== 32) {
    throw new Error('EMAIL_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
}

/**
 * Encrypt clear text before storing in DB
 * @param {string} clearText
 * @returns {{ iv: string, content: string, tag: string }}
 */
function encryptClearText(clearText) {
    if (!clearText) return null;

    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    const encrypted = Buffer.concat([
        cipher.update(clearText, 'utf8'),
        cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex'),
        tag: tag.toString('hex')
    };
}

/**
 * Decrypt stored encrypted text before sending to AI
 * @param {{ iv: string, content: string, tag: string }} encryptedData
 * @returns {string}
 */
function decryptClearText(encryptedData) {
    if (!encryptedData) return null;

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        KEY,
        Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedData.content, 'hex')),
        decipher.final()
    ]);

    return decrypted.toString('utf8');
}

module.exports = {
    encryptClearText,
    decryptClearText
};
