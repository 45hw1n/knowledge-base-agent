const { convert } = require('html-to-text');
const crypto = require('crypto');
const { encryptClearText } = require('./emailEncryption');


function decodeBase64(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    .toString('utf-8');
}

/**
 * Extract metadata + clean text from Gmail API full message
 */
async function extractEmailSnapshot(emailData) {
  const { default: EmailReplyParser } = await import('email-reply-parser');
  const { payload, id, threadId, snippet } = emailData;

  // -------------------------
  // 1️⃣ Extract Headers
  // -------------------------
  const headers = payload.headers || [];

  const getHeader = (name) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const metadata = {
    messageId: id,
    threadId,
    subject: getHeader('Subject') || 'No Subject',
    from: getHeader('From') || 'Unknown',
    date: getHeader('Date') || '',
    snippet: snippet || ''
  };

  // -------------------------
  // 2️⃣ Extract Raw Body (Recursive)
  // -------------------------
  function extractBody(part) {
    if (!part) return '';

    // If text/plain
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64(part.body.data);
    }

    // If text/html
    if (part.mimeType === 'text/html' && part.body?.data) {
      return decodeBase64(part.body.data);
    }

    // If multipart
    if (part.parts && part.parts.length) {
      for (const subPart of part.parts) {
        const result = extractBody(subPart);
        if (result) return result;
      }
    }

    return '';
  }

  function decodeBase64(data) {
    return Buffer.from(data, 'base64').toString('utf-8');
  }

  let rawBody = extractBody(payload);

  if (!rawBody) rawBody = snippet || '';

  // -------------------------
  // 3️⃣ Convert HTML → Text
  // -------------------------
  if (/<[a-z][\s\S]*>/i.test(rawBody)) {
    rawBody = convert(rawBody, {
      wordwrap: false,
      selectors: [
        { selector: 'img', format: 'skip' },
        { selector: 'a', options: { ignoreHref: true } }
      ]
    });
  }

  // -------------------------
  // 4️⃣ Remove Reply Chains
  // -------------------------
  rawBody = new EmailReplyParser()
    .read(rawBody)
    .getVisibleText();

  // -------------------------
  // 5️⃣ Clean Whitespace
  // -------------------------
  let cleanText = rawBody
    .replace(/\s+/g, ' ')
    .trim();

  // -------------------------
  // 6️⃣ Create Hash
  // -------------------------
  const bodyHash = crypto
    .createHash('sha256')
    .update(cleanText)
    .digest('hex');

  const encryptedCleanText = encryptClearText(cleanText);

  return {
    metadata,
    encryptedCleanText,
    bodyHash,
    snippet: snippet || cleanText.slice(0, 200),
    threadId
  };
}

module.exports = {
  decodeBase64,
  extractEmailSnapshot
};
