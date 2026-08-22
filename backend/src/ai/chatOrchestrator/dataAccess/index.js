const { findTicketsByFilters } = require('../../orchestrator/repositories/ticketRepository');
const { findInvoicesByFilters } = require('../../orchestrator/repositories/invoiceRepository');
const { findPaymentsByFilters } = require('../../orchestrator/repositories/paymentRepository');
const { findEventsByFilters } = require('../../orchestrator/repositories/eventRepository');
const { findDocumentsByFilters } = require('../../orchestrator/repositories/documentRepository');

// Dispatch table, mirroring the shape of `REPOSITORIES` in
// ai/orchestrator/index.js — adding a 6th data source later is one new
// reader function + one line here + one dataSourceRegistry.js entry, never
// a change to chatOrchestrator/index.js's core flow.
const DATA_SOURCE_READERS = {
  TICKET: findTicketsByFilters,
  INVOICE: findInvoicesByFilters,
  PAYMENT: findPaymentsByFilters,
  EVENT: findEventsByFilters,
  DOCUMENT: findDocumentsByFilters,
};

/**
 * Retrieves data for every query the intent step asked for — each entry
 * carries its OWN independently-validated filters (not one filter set
 * shared across every data source), which is what makes a cross-entity
 * question like "Plan my day" (today's events + open/urgent tickets, two
 * different filter sets) possible in a single turn. `queries` is assumed
 * already validated by `dataSourceRegistry.js`'s `validateQueries()` — this
 * function does not re-validate, it only dispatches.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {Array<{dataSource:string, filters:object}>} params.queries
 * @returns {Promise<{ data: Record<string, Array<object>>|null, error: string|null }>}
 */
async function retrieveData({ userId, queries }) {
  const results = {};
  for (const { dataSource, filters } of queries) {
    const reader = DATA_SOURCE_READERS[dataSource];
    if (!reader) continue; // the whitelist already guarantees valid sources; defensive only

    const { data, error } = await reader({ userId, filters });
    if (error) {
      return { data: null, error: `Failed to retrieve ${dataSource}: ${error}` };
    }
    results[dataSource] = data;
  }
  return { data: results, error: null };
}

module.exports = { DATA_SOURCE_READERS, retrieveData };
