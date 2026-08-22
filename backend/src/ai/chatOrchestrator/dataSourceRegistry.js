const {
  sanitizeStatus,
  sanitizeTicketLevel,
  sanitizeDateRange,
  sanitizeAmountRange,
  sanitizeDocumentType,
  sanitizeText,
} = require('./filterSanitizers');

/**
 * Whitelist of every data source the chat orchestrator can query, and the
 * filters each one accepts. The LLM's intent-extraction output is
 * validated against this table before anything reaches the data-access
 * layer — a data source or filter key not listed here is structurally
 * unreachable, not merely discouraged by a prompt instruction. See
 * decisions.md.
 *
 * Superseded the earlier per-named-intent (`GET_TICKETS` etc.) design: an
 * intent name mapping to exactly one hardcoded data source made
 * cross-entity questions ("Plan my day" — events + tickets in one turn)
 * impossible, and kept a redundant `intent` label that had to agree with
 * `dataSource` — trusting an LLM-echoed copy of a fact this table already
 * knows was itself a bug once (see the Phase 3 decisions.md entry on
 * `dataSources`). The LLM now names data sources directly.
 *
 * Only the 5 entity types that actually exist in this app are wired — the
 * illustrative "meeting"/"contact"/"email" data sources from the original
 * spec don't correspond to real collections yet. Adding a 6th later is one
 * new registry entry + one dataAccess dispatch-table line, not a pipeline
 * rewrite.
 */
const DATA_SOURCE_FILTERS = {
  TICKET: {
    status: sanitizeStatus.TICKET,
    urgency: sanitizeTicketLevel,
    priority: sanitizeTicketLevel,
    dateRange: sanitizeDateRange,
    keyword: sanitizeText,
  },
  INVOICE: {
    status: sanitizeStatus.INVOICE,
    dateRange: sanitizeDateRange,
    dueDateRange: sanitizeDateRange,
    amountRange: sanitizeAmountRange,
    keyword: sanitizeText,
  },
  PAYMENT: {
    dateRange: sanitizeDateRange,
    amountRange: sanitizeAmountRange,
    keyword: sanitizeText,
  },
  EVENT: {
    dateRange: sanitizeDateRange,
    keyword: sanitizeText,
  },
  DOCUMENT: {
    type: sanitizeDocumentType,
    effectiveDateRange: sanitizeDateRange,
    expiryDateRange: sanitizeDateRange,
    keyword: sanitizeText,
  },
};

const KNOWN_DATA_SOURCES = new Set(Object.keys(DATA_SOURCE_FILTERS));

// Defensive cap — an LLM emitting an unreasonable number of data-source
// requests in one turn gets truncated, not trusted wholesale.
const MAX_QUERIES_PER_TURN = 5;

/**
 * Validates raw LLM intent-extraction output shaped
 * `{ queries: [{ dataSource, filters }, ...] }`. Never throws — mirrors the
 * existing `validateExtracted<Type>()` convention (models/Ticket.js etc):
 * drops anything malformed/unwhitelisted rather than partially trusting a
 * shape it can't fully verify. An empty or all-invalid `queries` array is
 * not an error — it's the caller's signal to fall back to a graceful
 * "unsupported" message (see orchestrateChatTurn).
 *
 * @param {unknown} raw
 * @returns {{ data: {queries: Array<{dataSource:string, filters:object}>}|null, error: string|null }}
 */
function validateQueries(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.queries)) {
    return { data: null, error: 'Intent output must be an object with a "queries" array' };
  }

  const queries = [];
  for (const entry of raw.queries.slice(0, MAX_QUERIES_PER_TURN)) {
    if (!entry || typeof entry !== 'object') continue;
    if (!KNOWN_DATA_SOURCES.has(entry.dataSource)) continue;

    const allowedFilters = DATA_SOURCE_FILTERS[entry.dataSource];
    const rawFilters = entry.filters && typeof entry.filters === 'object' ? entry.filters : {};
    const filters = {};
    // Building `filters` by iterating the ALLOWED key set (not the
    // RECEIVED key set) is what makes a key absent from the whitelist
    // structurally unable to reach the data-access layer at all.
    for (const [key, sanitize] of Object.entries(allowedFilters)) {
      if (!(key in rawFilters)) continue;
      const sanitized = sanitize(rawFilters[key]);
      if (sanitized !== undefined) filters[key] = sanitized;
    }

    // De-dupe by dataSource — if the LLM names the same source twice,
    // merge into one query entry rather than issuing two reads for it
    // (keeps the eventual retrievedData keyed uniquely by dataSource).
    const existing = queries.find((q) => q.dataSource === entry.dataSource);
    if (existing) {
      Object.assign(existing.filters, filters);
    } else {
      queries.push({ dataSource: entry.dataSource, filters });
    }
  }

  return { data: { queries }, error: null };
}

module.exports = { DATA_SOURCE_FILTERS, KNOWN_DATA_SOURCES, validateQueries };
