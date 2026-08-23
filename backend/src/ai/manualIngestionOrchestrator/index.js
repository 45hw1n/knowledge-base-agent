const documentParserClient = require('../../documentParsing/client');
const { runStructuredExtraction } = require('../orchestrator/structuredExtraction');
const { summarizeBody } = require('../orchestrator/textSummaryProcessor');
const { persistTicketFromManualEntry } = require('../orchestrator/repositories/ticketRepository');
const { persistInvoiceFromManualEntry } = require('../orchestrator/repositories/invoiceRepository');
const { persistPaymentFromManualEntry } = require('../orchestrator/repositories/paymentRepository');
const { persistEventFromManualEntry } = require('../orchestrator/repositories/eventRepository');
const { persistDocumentFromManualEntry } = require('../orchestrator/repositories/documentRepository');
const ManualIngestionItem = require('../../models/ManualIngestionItem');

/**
 * The manual "Create Knowledge" flow's own pipeline — a fully separate
 * module from `ai/orchestrator/` (Gmail sync extraction) and
 * `ai/chatOrchestrator/` (chat), sharing only the leaf pieces that are
 * genuinely type-agnostic (`runStructuredExtraction`, `summarizeBody`,
 * `documentParserClient`). The email pipeline is hard-wired to Gmail
 * specifics at every layer it would otherwise be reused from — attachment
 * bytes come from `gmailService.fetchAttachment` (here they're already in
 * hand), the source URL is a Gmail deep link (here there is none), and
 * every repository's idempotency check is keyed on `emailDoc.messageId`
 * (here every submission is simply a new record). See decisions.md.
 *
 * Dispatch table, mirroring the shape of `REPOSITORIES` in
 * `ai/orchestrator/index.js` — adding a 6th type later is one new
 * `persist<Type>FromManualEntry` function + one line here.
 */
const MANUAL_REPOSITORIES = {
  TICKET: persistTicketFromManualEntry,
  INVOICE: persistInvoiceFromManualEntry,
  PAYMENT: persistPaymentFromManualEntry,
  EVENT: persistEventFromManualEntry,
  DOCUMENT: persistDocumentFromManualEntry,
};

/**
 * Merges the details-text extraction with each attachment's extraction.
 * The user's typed details are the primary source of truth — an attachment
 * only ever FILLS a field the details-based extraction left null/missing,
 * never overrides an explicit value. See decisions.md.
 *
 * @param {object|null} detailsData
 * @param {Array<object>} attachmentDataList
 * @returns {object}
 */
function mergeDetailsWithAttachments(detailsData, attachmentDataList) {
  const merged = { ...(detailsData || {}) };
  for (const attachmentData of attachmentDataList) {
    for (const [key, value] of Object.entries(attachmentData)) {
      if (value === null || value === undefined) continue;
      if (merged[key] === null || merged[key] === undefined) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

async function markFailed(manualIngestionItemId, code, message) {
  await ManualIngestionItem.updateOne(
    { _id: manualIngestionItemId },
    { $set: { status: 'FAILED', error: { code, message }, processingCompletedAt: new Date() } }
  );
}

/**
 * Runs the manual-ingestion pipeline for one submission and persists the
 * final status. Always called detached from the GraphQL request/response
 * cycle (fire-and-forget, same pattern as webhookController.js and the
 * chat feature's chatController.js) — the mutation has already responded
 * with `{creationId, status: 'PROCESSING'}` by the time this runs.
 *
 * @param {object} params
 * @param {string|ObjectId} params.manualIngestionItemId
 * @param {string|ObjectId} params.userId
 * @param {string} params.type - one of Entity.ENTITY_TYPES
 * @param {string} params.details - the user's free-text description
 * @param {Array<{buffer:Buffer, mimeType:string, fileName:string, storageKey:string, size:number}>} [params.attachmentBuffers] - already uploaded to R2 by the resolver; buffers passed straight through here for parsing, no re-fetch
 */
async function processManualIngestion({ manualIngestionItemId, userId, type, details, attachmentBuffers = [] }) {
  try {
    const { data: detailsData, error: detailsError } = await runStructuredExtraction(details, type);
    if (detailsError) {
      await markFailed(manualIngestionItemId, 'ORCHESTRATION_FAILED', detailsError);
      return;
    }

    const attachmentDataList = [];
    for (const attachment of attachmentBuffers) {
      try {
        const parsed = await documentParserClient.parse({
          buffer: attachment.buffer,
          mimeType: attachment.mimeType,
          fileName: attachment.fileName,
        });
        if (!parsed.text) continue;

        const { data, error } = await runStructuredExtraction(parsed.text, type);
        if (error) {
          console.error(`[manualIngestionOrchestrator] Extraction failed for attachment "${attachment.fileName}": ${error}`);
          continue;
        }
        if (data) attachmentDataList.push(data);
      } catch (error) {
        console.error(
          `[manualIngestionOrchestrator] Failed to parse attachment "${attachment.fileName}":`,
          error.message
        );
      }
    }

    const merged = mergeDetailsWithAttachments(detailsData, attachmentDataList);
    if (Object.keys(merged).length === 0) {
      await markFailed(
        manualIngestionItemId,
        'INVALID_EXTRACTION',
        `Could not extract any ${type} information from the provided details/attachments`
      );
      return;
    }

    const summary = await summarizeBody(details);

    const persist = MANUAL_REPOSITORIES[type];
    if (!persist) {
      await markFailed(manualIngestionItemId, 'PROCESSING_FAILED', `No repository configured for type "${type}"`);
      return;
    }

    const attachmentRefs = attachmentBuffers.map((attachment) => ({
      storageKey: attachment.storageKey,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
    }));

    const { entity, error: persistError } = await persist({ userId, extracted: merged, summary, attachmentRefs });
    if (persistError) {
      await markFailed(manualIngestionItemId, 'INVALID_EXTRACTION', persistError);
      return;
    }

    await ManualIngestionItem.updateOne(
      { _id: manualIngestionItemId },
      { $set: { status: 'COMPLETED', entityId: entity._id, summary, processingCompletedAt: new Date() } }
    );
  } catch (error) {
    await markFailed(manualIngestionItemId, 'PROCESSING_FAILED', error.message);
  }
}

module.exports = { processManualIngestion };
