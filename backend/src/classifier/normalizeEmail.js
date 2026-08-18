/**
 * Normalizes an already-parsed email (plain subject/from/to/body strings —
 * MIME decoding and HTML-to-text conversion already happened upstream, see
 * utils/helpers.js#extractEmailSnapshot) into the consistent shape the
 * classifier rules operate on.
 *
 * Deliberately independent of Gmail/MongoDB/AI — just string normalization.
 */

function extractDomain(fromAddress) {
  if (!fromAddress) return '';
  const match = String(fromAddress).match(/@([a-zA-Z0-9.-]+)/);
  return match ? match[1].toLowerCase() : '';
}

function normalizeEmail(raw = {}) {
  const subject = String(raw?.subject || '').trim();
  const from = String(raw?.from || '').trim();
  const to = String(raw?.to || '').trim();
  const snippet = String(raw?.snippet || '').trim();
  const bodyText = String(raw?.bodyText || snippet || '').trim();

  return {
    subject,
    from,
    fromDomain: extractDomain(from),
    to,
    bodyText,
    snippet,
    // Single lowercased blob for rules that search across subject + body
    // without caring which field the match came from.
    searchableText: `${subject}\n${bodyText}`.toLowerCase(),
    receivedAt: raw?.receivedAt || null,
  };
}

module.exports = { normalizeEmail, extractDomain };
