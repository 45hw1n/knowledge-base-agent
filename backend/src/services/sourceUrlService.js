/**
 * Builds the URL a user clicks to navigate back to an Entity's original
 * source. The AI never generates this — it's always derived here, from
 * provider metadata Cortex already controls, so it stays valid even after
 * the temporary `emails` record it came from expires (see decisions.md).
 *
 * One place per provider to change URL construction later; GMAIL and
 * MANUAL are implemented (see decisions.md — UPLOAD/API sources remain
 * unbuilt).
 */

const GMAIL_MESSAGE_URL_BASE = 'https://mail.google.com/mail/u/0/#all/';

function buildGmailMessageUrl(messageId) {
  return `${GMAIL_MESSAGE_URL_BASE}${messageId}`;
}

/**
 * @param {object} params
 * @param {string} params.provider - e.g. "GMAIL", "MANUAL"
 * @param {string} [params.messageId] - the provider's message id (Gmail's providerMessageId) — required for GMAIL only
 * @returns {string|null}
 */
function buildSourceUrl({ provider, messageId }) {
  switch (provider) {
    case 'GMAIL':
      if (!messageId) {
        throw new Error('messageId is required to build a GMAIL source URL');
      }
      return buildGmailMessageUrl(messageId);
    case 'MANUAL':
      // A manually-created entity has no durable "original document" to
      // link back to — an R2 object URL would need to be presigned and
      // would expire, the wrong shape for a field meant to be a permanent
      // reference. Entity.source.url / the typed child's sourceUrl are
      // both conditionally-not-required for this case; the frontend's
      // SourceFooter hides the "View original source" link when null.
      return null;
    default:
      throw new Error(`Unsupported source provider: ${provider}`);
  }
}

module.exports = { buildSourceUrl };
