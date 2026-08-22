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
  // Returns { text, mimeType } (or null) rather than a bare string — the
  // caller needs to know which MIME part actually supplied the text so it
  // never has to content-sniff for HTML (see step 3's comment for why that
  // was a real bug).
  function extractBody(part) {
    if (!part) return null;

    // If text/plain
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return { text: decodeBase64(part.body.data), mimeType: 'text/plain' };
    }

    // If text/html
    if (part.mimeType === 'text/html' && part.body?.data) {
      return { text: decodeBase64(part.body.data), mimeType: 'text/html' };
    }

    // If multipart
    if (part.parts && part.parts.length) {
      for (const subPart of part.parts) {
        const result = extractBody(subPart);
        if (result) return result;
      }
    }

    return null;
  }

  function decodeBase64(data) {
    return Buffer.from(data, 'base64').toString('utf-8');
  }

  const extractedBody = extractBody(payload);
  let rawBody = extractedBody?.text || snippet || '';

  // -------------------------
  // 3️⃣ Convert HTML → Text
  // -------------------------
  // Only ever convert when the source part we actually extracted from WAS
  // text/html — never content-sniff via a regex like /<[a-z][\s\S]*>/i.
  // That regex matches any plain-text quote header too (e.g. "...Ashwin S
  // <s.ashwin@example.com> wrote:" looks exactly like an HTML tag to it),
  // wrongly running a genuinely plain-text body through html-to-text's
  // convert() — which collapses all line breaks into spaces. Once the text
  // is one flattened line, EmailReplyParser below (which depends on line
  // boundaries to find where a quote starts) can no longer strip the
  // quoted reply chain at all. Discovered via real conversation-message
  // content still containing the full quoted thread — see decisions.md.
  if (extractedBody?.mimeType === 'text/html') {
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
    // Plaintext body, pre-encryption — needed by callers (e.g. the
    // classifier) that must read the content but shouldn't reimplement
    // MIME/HTML parsing or hold their own decryption logic.
    cleanText,
    bodyHash,
    snippet: snippet || cleanText.slice(0, 200),
    threadId
  };
}

module.exports = {
  decodeBase64,
  extractEmailSnapshot
};
