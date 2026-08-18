/**
 * Deterministic Payment↔Invoice matching. Reuses the same weighted-signal
 * scoring pattern as the email classifier (classifier/classifier.js) — each
 * piece of evidence contributes a weight, and a match is only accepted once
 * the combined score clears a threshold. This module does NOT decide
 * whether a given email is relevant to an Invoice, or whether it describes
 * a payment confirmation at all — those are semantic judgments the spec
 * explicitly assigns to the LLM. This module only answers, given a payment
 * has already been identified: which (if any) existing Invoice does it
 * settle? See decisions.md.
 *
 * Deliberately never links on amount alone ("do not blindly link a Payment
 * to an Invoice based only on amount") — every accepted match requires
 * either one very strong signal (an exact invoice number / transaction
 * reference match) or at least two corroborating weaker signals together.
 */

// Below this combined score, `findMatchingInvoice` returns no match rather
// than guessing — the caller should persist the Payment with `invoiceId: null`.
const MATCH_THRESHOLD = 0.6;

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function personMatches(a, b) {
  if (!a || !b) return false;
  if (a.email && b.email && normalize(a.email) === normalize(b.email)) return true;
  if (a.name && b.name && normalize(a.name) === normalize(b.name)) return true;
  return false;
}

function amountsMatch(a, b) {
  if (a?.value == null || b?.value == null) return false;
  if (a.value !== b.value) return false;
  // Currency mismatch, when both are actually stated, disqualifies the
  // match — but an unstated currency on either side doesn't block it.
  if (a.currency && b.currency && normalize(a.currency) !== normalize(b.currency)) return false;
  return true;
}

// `evidence` is a plain bag of whatever was extracted about a payment —
// intentionally NOT required to match the persisted Payment schema exactly
// (e.g. `invoiceNumber`/`transactionRef` may only ever be extraction-time
// evidence, later folded into Payment.metadata rather than kept as their
// own top-level fields). `invoice` is an Invoice-shaped object (or a lean
// Mongoose document).
const SIGNALS = [
  {
    id: 'exact_invoice_number',
    weight: 1.0,
    test: (evidence, invoice) =>
      Boolean(evidence.invoiceNumber) &&
      Boolean(invoice.invoiceNumber) &&
      normalize(evidence.invoiceNumber) === normalize(invoice.invoiceNumber),
  },
  {
    id: 'exact_transaction_ref',
    weight: 1.0,
    test: (evidence, invoice) =>
      Boolean(evidence.transactionRef) &&
      Boolean(invoice.metadata?.transactionRef) &&
      normalize(evidence.transactionRef) === normalize(invoice.metadata.transactionRef),
  },
  {
    id: 'same_thread',
    weight: 0.3,
    test: (evidence, invoice) =>
      Boolean(evidence.threadId) && Boolean(invoice.threadId) && evidence.threadId === invoice.threadId,
  },
  {
    id: 'exact_amount',
    weight: 0.35,
    test: (evidence, invoice) => amountsMatch(evidence.amount, invoice.amount),
  },
  {
    id: 'payee_matches_issuer',
    weight: 0.25,
    test: (evidence, invoice) => personMatches(evidence.payee, invoice.issuer),
  },
  {
    id: 'payer_matches_issuer',
    weight: 0.15,
    test: (evidence, invoice) => personMatches(evidence.payer, invoice.issuer),
  },
];

/**
 * Scores one payment-evidence/invoice pair.
 * @returns {{ score: number, matchedSignals: string[] }}
 */
function scoreMatch(evidence, invoice) {
  const matchedSignals = [];
  let score = 0;

  for (const signal of SIGNALS) {
    let matched = false;
    try {
      matched = Boolean(signal.test(evidence, invoice));
    } catch (error) {
      matched = false;
    }
    if (matched) {
      matchedSignals.push(signal.id);
      score += signal.weight;
    }
  }

  return { score: Math.min(1, Number(score.toFixed(2))), matchedSignals };
}

/**
 * Finds the best-matching Invoice for a payment, among a caller-supplied
 * list of candidates (the caller decides how to fetch candidates — e.g.
 * scoped to the same userId, and/or the same threadId, and/or an UNPAID
 * status — this function only scores and picks, it never queries the DB).
 *
 * @param {object} evidence - { invoiceNumber?, transactionRef?, amount?, payer?, payee?, threadId? }
 * @param {Array<object>} candidateInvoices
 * @returns {{ invoice: object, score: number, matchedSignals: string[] } | null}
 */
function findMatchingInvoice(evidence, candidateInvoices) {
  if (!evidence || !Array.isArray(candidateInvoices)) return null;

  let best = null;
  for (const invoice of candidateInvoices) {
    const { score, matchedSignals } = scoreMatch(evidence, invoice);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { invoice, score, matchedSignals };
    }
  }

  return best;
}

/**
 * Derives Payment.linkMethod ('THREAD_CONTEXT' | 'RECONCILED') from a
 * findMatchingInvoice() result — the same underlying scoring function
 * handles both the "reply inside the invoice's own thread" case and the
 * "bank email matched by other evidence" case; the only thing that
 * distinguishes them is whether the `same_thread` signal contributed to
 * the match. Returns null for no match (nothing to link, no method to
 * record) — 'MANUAL' is never derived here, since manual linking doesn't
 * go through this scoring function at all.
 *
 * @param {{ matchedSignals: string[] } | null} matchResult
 * @returns {string|null}
 */
function determineLinkMethod(matchResult) {
  if (!matchResult) return null;
  return matchResult.matchedSignals?.includes('same_thread') ? 'THREAD_CONTEXT' : 'RECONCILED';
}

module.exports = { findMatchingInvoice, scoreMatch, determineLinkMethod, MATCH_THRESHOLD };
