const Invoice = require('../../../models/Invoice');
const { validateExtractedInvoice } = Invoice;
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { createEntityForTypedChild, buildInitialConversationMessage, createEntityForManualEntry, buildManualConversationSeed } = require('./entityRepository');
const { MAX_RESULTS, escapeRegExp, attachEntityMetadata } = require('./queryHelpers');

function buildInvoiceTitle(invoice) {
    if (invoice.invoiceNumber) return `Invoice ${invoice.invoiceNumber}`;
    const amount = invoice.amount?.value;
    const currency = invoice.amount?.currency || '';
    return amount != null ? `Invoice for ${amount} ${currency}`.trim() : 'Invoice';
}

/**
 * Persists an extracted Invoice and its Entity row. Idempotent on
 * (userId, messageId) — if this email already produced an Invoice (e.g. a
 * retried extraction after a stale-PROCESSING reclaim), returns the
 * existing one rather than creating a duplicate, and still ensures its
 * Entity row exists (in case the earlier attempt got that far).
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {import('mongoose').Document} params.emailDoc
 * @param {object} params.extracted - structured fields from documentProcessor/structuredExtraction
 * @param {string} [params.summary] - from textSummaryProcessor
 * @param {string|null} [params.aiModel]
 * @returns {Promise<{ invoice: object|null, entity: object|null, error: string|null }>}
 */
async function persistInvoice({ userId, emailDoc, extracted, summary, aiModel = null }) {
    const existing = await Invoice.findOne({ userId, messageId: emailDoc.messageId });
    if (existing) {
        const entity = await createEntityForTypedChild({
            userId, type: 'INVOICE', title: buildInvoiceTitle(existing), entityId: existing._id, emailDoc, aiModel,
        });
        return { invoice: existing, entity, error: null };
    }

    const sourceUrl = buildSourceUrl({ provider: 'GMAIL', messageId: emailDoc.messageId });
    const initialMessage = await buildInitialConversationMessage({ userId, emailDoc });
    const raw = {
        ...extracted,
        sourceUrl,
        sourceType: 'EMAIL',
        threadId: emailDoc.threadId || null,
        messageId: emailDoc.messageId,
        metadata: summary ? { summary } : {},
        conversation: initialMessage ? [initialMessage] : [],
    };

    const { invoice: validated, error } = validateExtractedInvoice(raw);
    if (error) return { invoice: null, entity: null, error };

    let invoice;
    try {
        invoice = await Invoice.create({ userId, ...validated });
    } catch (createError) {
        if (createError.code === 11000) {
            invoice = await Invoice.findOne({ userId, messageId: emailDoc.messageId });
        } else {
            throw createError;
        }
    }

    const entity = await createEntityForTypedChild({
        userId, type: 'INVOICE', title: buildInvoiceTitle(invoice), entityId: invoice._id, emailDoc, aiModel,
    });

    return { invoice, entity, error: null };
}

/**
 * Reads Invoices for the chat data-access layer. Never spreads `filters`
 * into the Mongo query — only the specific, sanitized keys the chat
 * orchestrator's filterSanitizers.js already validated are ever read here.
 * Invoice has no `title` field of its own (that lives on Entity, set from
 * buildInvoiceTitle at creation) — `keyword` matches against
 * `invoiceNumber`/`issuer.name` instead.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {{status?:string, dateRange?:{from?:Date,to?:Date}, dueDateRange?:{from?:Date,to?:Date}, amountRange?:{min?:number,max?:number}, keyword?:string}} params.filters
 * @returns {Promise<{ data: Array<object>|null, error: string|null }>}
 */
async function findInvoicesByFilters({ userId, filters = {} }) {
    try {
        const query = { userId };
        if (filters.status) query.status = filters.status;
        if (filters.dateRange) {
            query.createdAt = {};
            if (filters.dateRange.from) query.createdAt.$gte = filters.dateRange.from;
            if (filters.dateRange.to) query.createdAt.$lte = filters.dateRange.to;
        }
        if (filters.dueDateRange) {
            query.dueDate = {};
            if (filters.dueDateRange.from) query.dueDate.$gte = filters.dueDateRange.from;
            if (filters.dueDateRange.to) query.dueDate.$lte = filters.dueDateRange.to;
        }
        if (filters.amountRange) {
            query['amount.value'] = {};
            if (filters.amountRange.min !== undefined) query['amount.value'].$gte = filters.amountRange.min;
            if (filters.amountRange.max !== undefined) query['amount.value'].$lte = filters.amountRange.max;
        }
        if (filters.keyword) {
            const pattern = { $regex: escapeRegExp(filters.keyword), $options: 'i' };
            query.$or = [{ invoiceNumber: pattern }, { 'issuer.name': pattern }];
        }

        const invoices = await Invoice.find(query).sort({ createdAt: -1 }).limit(MAX_RESULTS).lean();
        const data = await attachEntityMetadata({
            userId,
            type: 'INVOICE',
            docs: invoices,
            mapFields: (invoice) => ({
                status: invoice.status,
                amount: invoice.amount,
                dueDate: invoice.dueDate,
                sourceUrl: invoice.sourceUrl,
            }),
        });
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error.message };
    }
}

/**
 * Persists an Invoice from the manual "Create Knowledge" flow — see
 * ticketRepository.js's persistTicketFromManualEntry for the shared
 * reasoning (no emailDoc, no idempotency lookup, sourceType DOCUMENT) and
 * for why uploaded attachments are seeded into `conversation[]` rather
 * than a top-level field (Invoice has none, like Ticket).
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {object} params.extracted
 * @param {string} params.details - the user's original free-text submission
 * @param {string} [params.summary]
 * @param {Array<{storageKey:string, fileName:string, mimeType:string, size:number}>} [params.attachmentRefs]
 * @returns {Promise<{ invoice: object|null, entity: object|null, error: string|null }>}
 */
async function persistInvoiceFromManualEntry({ userId, extracted, details, summary, attachmentRefs = [] }) {
    const raw = {
        ...extracted,
        sourceUrl: buildSourceUrl({ provider: 'MANUAL' }),
        sourceType: 'DOCUMENT',
        threadId: null,
        messageId: null,
        metadata: summary ? { summary } : {},
        conversation: buildManualConversationSeed({ details, attachmentRefs }),
    };

    const { invoice: validated, error } = validateExtractedInvoice(raw);
    if (error) return { invoice: null, entity: null, error };

    const invoice = await Invoice.create({ userId, ...validated });

    const entity = await createEntityForManualEntry({
        userId, type: 'INVOICE', title: buildInvoiceTitle(invoice), entityId: invoice._id,
    });

    return { invoice, entity, error: null };
}

module.exports = { persistInvoice, buildInvoiceTitle, findInvoicesByFilters, persistInvoiceFromManualEntry };
