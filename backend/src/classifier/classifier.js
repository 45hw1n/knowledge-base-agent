const invoiceRules = require('./rules/invoice.rules');
const ticketRules = require('./rules/ticket.rules');
const paymentRules = require('./rules/payment.rules');
const eventRules = require('./rules/event.rules');
const documentRules = require('./rules/document.rules');

// Fixed, deterministic evaluation order. Also the tie-break priority when
// two types land on the exact same score (earlier in this list wins) —
// scoring differences decide almost every real case; this only matters
// for a true tie.
const RULE_SETS = [
  { type: 'INVOICE', rules: invoiceRules },
  { type: 'TICKET', rules: ticketRules },
  { type: 'PAYMENT', rules: paymentRules },
  { type: 'EVENT', rules: eventRules },
  { type: 'DOCUMENT', rules: documentRules },
];

// Minimum combined rule weight required to accept a classification at all.
// Below this, the email is considered not useful and should be discarded.
const ACCEPT_THRESHOLD = 0.4;

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
 * Classifies a normalized email into one of the known entity types, or
 * signals "no useful match" so the caller can discard it.
 *
 * @param {object} normalizedEmail - output of normalizeEmail()
 * @returns {{ type: string|null, confidence: number, matchedRules: string[] }}
 */
function classify(normalizedEmail) {
  let best = null;

  for (const { type, rules } of RULE_SETS) {
    const { score, matchedRules } = scoreRuleSet(normalizedEmail, rules);

    if (score >= ACCEPT_THRESHOLD && (!best || score > best.score)) {
      best = { type, score, matchedRules };
    }
  }

  if (!best) {
    return { type: null, confidence: 0, matchedRules: [] };
  }

  return {
    type: best.type,
    confidence: Math.min(1, Number(best.score.toFixed(2))),
    matchedRules: best.matchedRules,
  };
}

const ENTITY_TYPES = RULE_SETS.map((r) => r.type);

module.exports = { classify, ACCEPT_THRESHOLD, ENTITY_TYPES };
