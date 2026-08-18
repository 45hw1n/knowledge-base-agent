/**
 * Builds the URL a user clicks to navigate back to an Entity's original
 * source. The AI never generates this — it's always derived here, from
 * provider metadata Cortex already controls, so it stays valid even after
 * the temporary `emails` record it came from expires (see decisions.md).
 *
 * One place per provider to change URL construction later; only GMAIL is
 * implemented for now (see decisions.md — deliberately not building
 * UPLOAD/API/MANUAL yet).
 */

const GMAIL_MESSAGE_URL_BASE = 'https://mail.google.com/mail/u/0/#all/';

function buildGmailMessageUrl(messageId) {
  return `${GMAIL_MESSAGE_URL_BASE}${messageId}`;
}

/**
 * @param {object} params
 * @param {string} params.provider - e.g. "GMAIL"
 * @param {string} params.messageId - the provider's message id (Gmail's providerMessageId)
 * @returns {string}
 */
function buildSourceUrl({ provider, messageId }) {
  if (!messageId) {
    throw new Error('messageId is required to build a source URL');
  }

  switch (provider) {
    case 'GMAIL':
      return buildGmailMessageUrl(messageId);
    default:
      throw new Error(`Unsupported source provider: ${provider}`);
  }
}

module.exports = { buildSourceUrl };
