const invoiceRules = require('./rules/invoice.rules');
const ticketRules = require('./rules/ticket.rules');
const paymentRules = require('./rules/payment.rules');
const eventRules = require('./rules/event.rules');
const documentRules = require('./rules/document.rules');

// Fixed evaluation order. Ordering has no effect on the result — candidates
// are sorted by score — it only exists so iteration is deterministic across
// runs/environments.
const RULE_SETS = [
  { type: 'INVOICE', rules: invoiceRules },
  { type: 'TICKET', rules: ticketRules },
  { type: 'PAYMENT', rules: paymentRules },
  { type: 'EVENT', rules: eventRules },
  { type: 'DOCUMENT', rules: documentRules },
];

function scoreRuleSet(normalizedEmail, rules) {
  const matchedRules = [];
  let score = 0;

  for (const rule of rules) {
    let matched = false;
    try {
      matched = Boolean(rule.test(normalizedEmail));
    } catch (error) {
      // A single malformed input must never crash classification — treat
      // an errored rule as "did not match".
      matched = false;
    }

    if (matched) {
      matchedRules.push(rule.id);
      score += rule.weight;
    }
  }

  return { score, matchedRules };
}

/**
 * Classifies a normalized email into candidate entity types. Regex
 * identifies signals and proposes candidates — it does not claim to fully
 * understand the email, so ambiguous emails legitimately produce more than
 * one candidate (e.g. "Payment failed" scores both PAYMENT and TICKET;
 * PAYMENT should rank higher given a payment-processor sender + amount +
 * transaction id, but the weaker TICKET signal is still surfaced rather
 * than silently dropped).
 *
 * An email matching nothing (no candidates) means "not useful — discard".
 *
 * @param {object} normalizedEmail - output of normalizeEmail()
 * @returns {{ candidates: Array<{ type: string, score: number, matchedRules: string[] }> }}
 */
function classify(normalizedEmail) {
  const candidates = RULE_SETS.map(({ type, rules }) => {
    const { score, matchedRules } = scoreRuleSet(normalizedEmail, rules);
    return { type, score: Math.min(1, Number(score.toFixed(2))), matchedRules };
  })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  return { candidates };
}

const ENTITY_TYPES = RULE_SETS.map((r) => r.type);

module.exports = { classify, ENTITY_TYPES };
