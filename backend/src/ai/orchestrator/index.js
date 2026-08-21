const { decryptClearText } = require('../../utils/emailEncryption');
const { runDocumentProcessor } = require('./documentProcessor');
const { runStructuredExtraction } = require('./structuredExtraction');
const { summarizeBody } = require('./textSummaryProcessor');
const { persistInvoice } = require('./repositories/invoiceRepository');
const { persistPayment } = require('./repositories/paymentRepository');
const { persistEvent } = require('./repositories/eventRepository');
const { persistTicket } = require('./repositories/ticketRepository');
const { persistDocument } = require('./repositories/documentRepository');

// Per-type repository, keyed the same way as structuredExtraction.js's
// PROMPT_BUILDERS — one dispatch table, not five near-identical branches.
// Types without an entry here simply aren't built yet (see decisions.md's
// phased build order); extractAndPersistEntity() reports that explicitly
// rather than silently doing nothing.
const REPOSITORIES = {
    INVOICE: persistInvoice,
    PAYMENT: persistPayment,
    EVENT: persistEvent,
    TICKET: persistTicket,
    DOCUMENT: persistDocument,
};

function decryptBodyText(emailDoc) {
    if (!emailDoc.encryptedCleanText) return '';
    try {
        return decryptClearText(emailDoc.encryptedCleanText) || '';
    } catch (error) {
        console.error(`[orchestrator] Failed to decrypt body for messageId=${emailDoc.messageId}:`, error.message);
        return '';
    }
}

/**
 * The real, type-aware replacement for the old generic
 * ai/features/extractEntities orchestrator (deleted alongside this — see
 * decisions.md). For the email's top classifier candidate:
 *
 *   attachments? → Document Processor (per-attachment structured extraction,
 *                    reconciled across attachments)
 *     no usable result → fall back to structured extraction against the
 *                    email body directly (same extraction function, body
 *                    text instead of attachment text)
 *   always → Text/Summary Processor over the email body (secondary/context,
 *                    never a source of the primary structured fields)
 *   → type-specific repository: validate, persist, create Entity row
 *
 * @param {import('mongoose').Document} emailDoc - an EmailToProcess record
 * @returns {Promise<{ entityCreated: boolean, entityId: string|null, type: string|null, error: string|null }>}
 */
async function extractAndPersistEntity(emailDoc) {
    const candidates = emailDoc.classification?.candidates || [];
    if (candidates.length === 0) {
        // Shouldn't happen — emails with zero candidates are discarded at
        // ingestion (syncEmailsService.js) and never reach this stage.
        return { entityCreated: false, entityId: null, type: null, error: 'No classifier candidates on this email' };
    }

    const type = candidates[0].type;
    const bodyText = decryptBodyText(emailDoc);

    let structured = null;
    if ((emailDoc.attachments || []).length > 0) {
        structured = await runDocumentProcessor({ emailDoc, type });
    }

    if (!structured) {
        const { data, error } = await runStructuredExtraction(bodyText, type);
        if (error) {
            return { entityCreated: false, entityId: null, type, error };
        }
        structured = data;
    }

    if (!structured) {
        return {
            entityCreated: false,
            entityId: null,
            type,
            error: `No ${type} data could be extracted from this email's attachments or body`,
        };
    }

    const summary = await summarizeBody(bodyText);

    const persist = REPOSITORIES[type];
    if (!persist) {
        return { entityCreated: false, entityId: null, type, error: `No repository configured for type "${type}"` };
    }

    const { entity, error } = await persist({ userId: emailDoc.accountUserId, emailDoc, extracted: structured, summary });
    if (error) {
        return { entityCreated: false, entityId: null, type, error };
    }

    return { entityCreated: true, entityId: entity._id.toString(), type, error: null };
}

module.exports = { extractAndPersistEntity };
