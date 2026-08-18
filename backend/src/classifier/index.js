const { normalizeEmail, extractDomain } = require('./normalizeEmail');
const { classify, ACCEPT_THRESHOLD, ENTITY_TYPES } = require('./classifier');

/**
 * Convenience wrapper: normalize + classify in one call.
 * @param {object} rawEmail - { subject, from, to, bodyText, snippet, receivedAt }
 */
function classifyEmail(rawEmail) {
  return classify(normalizeEmail(rawEmail));
}

module.exports = {
  normalizeEmail,
  extractDomain,
  classify,
  classifyEmail,
  ACCEPT_THRESHOLD,
  ENTITY_TYPES,
};
