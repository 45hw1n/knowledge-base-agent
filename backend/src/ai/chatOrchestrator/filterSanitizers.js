const { TICKET_STATUSES, TICKET_LEVELS } = require('../../models/Ticket');
const { INVOICE_STATUSES } = require('../../models/Invoice');
const { DOCUMENT_TYPES } = require('../../models/Document');

/**
 * Per-filter-key typed sanitizers for the chat intent registry. Whitelisting
 * filter *keys* alone is not enough — an LLM (or content it was shown, e.g.
 * a prompt-injected email body surfacing in retrieved data on a later turn)
 * could otherwise pass a Mongo operator object as a filter "value" (e.g.
 * `{status: {"$ne": null}}`). Every sanitizer here takes an arbitrary value
 * and returns either a safe primitive/plain-date-object, or `undefined` —
 * `undefined` means "reject this filter," never "pass it through as-is."
 * See decisions.md.
 */

function sanitizeEnum(allowedValues) {
  return function sanitize(value) {
    return typeof value === 'string' && allowedValues.includes(value) ? value : undefined;
  };
}

const sanitizeStatus = {
  TICKET: sanitizeEnum(TICKET_STATUSES),
  INVOICE: sanitizeEnum(INVOICE_STATUSES),
};

// TICKET_LEVELS (LOW|MEDIUM|HIGH|CRITICAL) is shared between Ticket.urgency
// and Ticket.priority — kept as two distinct filter keys below (matching
// the model's own "urgency vs priority answer different questions"
// distinction, see Ticket.js) even though they share one sanitizer.
const sanitizeTicketLevel = sanitizeEnum(TICKET_LEVELS);

const sanitizeDocumentType = sanitizeEnum(DOCUMENT_TYPES);

// {from?, to?} — each independently `new Date()`-parsed and rejected if
// unparseable. The intent-extraction prompt instructs the LLM to always
// emit absolute ISO 8601 dates — this sanitizer only ever validates, it
// never interprets relative language like "today"/"this week" itself.
function sanitizeDateRange(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const result = {};
  if (value.from !== undefined && value.from !== null) {
    const from = new Date(value.from);
    if (Number.isNaN(from.getTime())) return undefined;
    result.from = from;
  }
  if (value.to !== undefined && value.to !== null) {
    const to = new Date(value.to);
    if (Number.isNaN(to.getTime())) return undefined;
    result.to = to;
  }
  return Object.keys(result).length ? result : undefined;
}

// Free-text keyword filter — string-only, trimmed, length-capped. The
// data-access layer's readers still must independently escape this before
// using it in any $regex (see queryHelpers.js's escapeRegExp) — this
// sanitizer only guarantees the VALUE is a bounded string, not that it's
// already regex-safe.
function sanitizeText(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, 200);
  return trimmed || undefined;
}

// {min?, max?} numeric range — same contract/shape as sanitizeDateRange,
// just numeric instead of date. Rejects non-finite values (NaN, Infinity,
// non-numbers) and rejects an incoherent range (min > max) outright rather
// than applying half of it.
function sanitizeAmountRange(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const result = {};
  if (value.min !== undefined && value.min !== null) {
    const min = Number(value.min);
    if (!Number.isFinite(min)) return undefined;
    result.min = min;
  }
  if (value.max !== undefined && value.max !== null) {
    const max = Number(value.max);
    if (!Number.isFinite(max)) return undefined;
    result.max = max;
  }
  if (result.min !== undefined && result.max !== undefined && result.min > result.max) return undefined;
  return Object.keys(result).length ? result : undefined;
}

module.exports = {
  sanitizeStatus,
  sanitizeTicketLevel,
  sanitizeDateRange,
  sanitizeAmountRange,
  sanitizeDocumentType,
  sanitizeText,
};
