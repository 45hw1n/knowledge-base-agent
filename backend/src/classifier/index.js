const { normalizeEmail, extractDomain } = require('./normalizeEmail');
const { classify, ENTITY_TYPES } = require('./classifier');

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
  ENTITY_TYPES,
};
