const Invoice = require('../../../models/Invoice');
const { validateExtractedInvoice } = Invoice;
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { createEntityForTypedChild } = require('./entityRepository');

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
    const raw = {
        ...extracted,
        sourceUrl,
        sourceType: 'EMAIL',
        threadId: emailDoc.threadId || null,
        messageId: emailDoc.messageId,
        metadata: summary ? { summary } : {},
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

module.exports = { persistInvoice, buildInvoiceTitle };
