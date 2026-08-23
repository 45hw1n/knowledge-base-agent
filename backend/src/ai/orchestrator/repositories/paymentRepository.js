const Payment = require('../../../models/Payment');
const { validateExtractedPayment } = Payment;
const Invoice = require('../../../models/Invoice');
const { determineInvoiceStatus } = Invoice;
const { findMatchingInvoice, determineLinkMethod } = require('../../../services/paymentReconciliationService');
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { createEntityForTypedChild, createEntityForManualEntry } = require('./entityRepository');
const { MAX_RESULTS, escapeRegExp, attachEntityMetadata } = require('./queryHelpers');

function buildPaymentTitle(payment) {
    const amount = payment.amount?.value;
    const currency = payment.amount?.currency || '';
    return amount != null ? `Payment of ${amount} ${currency}`.trim() : 'Payment';
}

/**
 * Auto-links a Payment to an Invoice only via the same-Gmail-thread path —
 * candidates are restricted to Invoices sharing this Payment's threadId, so
 * determineLinkMethod() can only ever resolve to 'THREAD_CONTEXT', never
 * 'RECONCILED'. Cross-thread reconciliation (a bank alert matched only by
 * amount/payee in a different thread) is deliberately not attempted here —
 * those stay unlinked for the user to link manually. See decisions.md.
 *
 * No-op if the payment is already linked, or has no threadId.
 */
async function autoLinkBySameThread(payment) {
    if (payment.invoiceId || !payment.threadId) return payment;

    const candidates = await Invoice.find({ userId: payment.userId, threadId: payment.threadId });
    if (candidates.length === 0) return payment;

    const evidence = {
        amount: payment.amount,
        payer: payment.payer,
        payee: payment.payee,
        threadId: payment.threadId,
    };

    const match = findMatchingInvoice(evidence, candidates);
    if (!match) return payment;

    const linkMethod = determineLinkMethod(match);

    await Payment.updateOne(
        { _id: payment._id },
        { $set: { invoiceId: match.invoice._id, linkMethod } }
    );
    payment.invoiceId = match.invoice._id;
    payment.linkMethod = linkMethod;

    const linkedPayments = await Payment.find({ userId: payment.userId, invoiceId: match.invoice._id }).lean();
    const newStatus = determineInvoiceStatus({
        invoiceAmount: match.invoice.amount,
        dueDate: match.invoice.dueDate,
        linkedPayments,
    });
    await Invoice.updateOne({ _id: match.invoice._id }, { $set: { status: newStatus } });

    return payment;
}

/**
 * Persists an extracted Payment, its Entity row, and (if a same-thread
 * Invoice match clears the reconciliation threshold) its auto-link.
 * Idempotent on (userId, messageId) — same reasoning as invoiceRepository.js.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {import('mongoose').Document} params.emailDoc
 * @param {object} params.extracted
 * @param {string} [params.summary]
 * @param {string|null} [params.aiModel]
 * @returns {Promise<{ payment: object|null, entity: object|null, error: string|null }>}
 */
async function persistPayment({ userId, emailDoc, extracted, summary, aiModel = null }) {
    const existing = await Payment.findOne({ userId, messageId: emailDoc.messageId });
    if (existing) {
        const entity = await createEntityForTypedChild({
            userId, type: 'PAYMENT', title: buildPaymentTitle(existing), entityId: existing._id, emailDoc, aiModel,
        });
        return { payment: existing, entity, error: null };
    }

    const sourceUrl = buildSourceUrl({ provider: 'GMAIL', messageId: emailDoc.messageId });

    // Payment.paidAt is schema-required — a Payment represents a settlement
    // that already happened, so if the AI didn't find an explicit payment
    // date, fall back to the source email's own Date header rather than
    // rejecting the extraction. See decisions.md.
    const fallbackPaidAt = emailDoc.date ? new Date(emailDoc.date) : null;
    const paidAt = extracted?.paidAt || (fallbackPaidAt && !Number.isNaN(fallbackPaidAt.getTime()) ? fallbackPaidAt : null);

    const raw = {
        ...extracted,
        paidAt,
        sourceUrl,
        sourceType: 'EMAIL',
        threadId: emailDoc.threadId || null,
        messageId: emailDoc.messageId,
        metadata: summary ? { summary } : {},
    };

    const { payment: validated, error } = validateExtractedPayment(raw);
    if (error) return { payment: null, entity: null, error };

    let payment;
    try {
        payment = await Payment.create({ userId, ...validated });
    } catch (createError) {
        if (createError.code === 11000) {
            payment = await Payment.findOne({ userId, messageId: emailDoc.messageId });
        } else {
            throw createError;
        }
    }

    if (!payment.invoiceId) {
        payment = await autoLinkBySameThread(payment);
    }

    const entity = await createEntityForTypedChild({
        userId, type: 'PAYMENT', title: buildPaymentTitle(payment), entityId: payment._id, emailDoc, aiModel,
    });

    return { payment, entity, error: null };
}

/**
 * Reads Payments for the chat data-access layer. Payment has no `status`
 * field at all (its settlement's success signal lives on the linked
 * Invoice, not here — see Payment.js) — only `dateRange` (against `paidAt`,
 * the date money actually moved) and `keyword` (against `payer.name`/
 * `payee.name`, since Payment has no title-like text field of its own) are
 * ever whitelisted for this data source. Never spreads `filters` into the
 * Mongo query — only these specific, sanitized keys are read.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {{dateRange?:{from?:Date,to?:Date}, amountRange?:{min?:number,max?:number}, keyword?:string}} params.filters
 * @returns {Promise<{ data: Array<object>|null, error: string|null }>}
 */
async function findPaymentsByFilters({ userId, filters = {} }) {
    try {
        const query = { userId };
        if (filters.dateRange) {
            query.paidAt = {};
            if (filters.dateRange.from) query.paidAt.$gte = filters.dateRange.from;
            if (filters.dateRange.to) query.paidAt.$lte = filters.dateRange.to;
        }
        if (filters.amountRange) {
            query['amount.value'] = {};
            if (filters.amountRange.min !== undefined) query['amount.value'].$gte = filters.amountRange.min;
            if (filters.amountRange.max !== undefined) query['amount.value'].$lte = filters.amountRange.max;
        }
        if (filters.keyword) {
            const pattern = { $regex: escapeRegExp(filters.keyword), $options: 'i' };
            query.$or = [{ 'payer.name': pattern }, { 'payee.name': pattern }];
        }

        const payments = await Payment.find(query).sort({ paidAt: -1 }).limit(MAX_RESULTS).lean();
        const data = await attachEntityMetadata({
            userId,
            type: 'PAYMENT',
            docs: payments,
            mapFields: (payment) => ({
                amount: payment.amount,
                paidAt: payment.paidAt,
                invoiceId: payment.invoiceId,
                sourceUrl: payment.sourceUrl,
            }),
        });
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error.message };
    }
}

/**
 * Persists a Payment from the manual "Create Knowledge" flow — see
 * ticketRepository.js's persistTicketFromManualEntry for the shared
 * reasoning. `paidAt` falls back to submission time (not an email's Date
 * header, which doesn't exist here) if extraction found no explicit date —
 * same "never reject when a reasonable fallback exists" principle as the
 * email pipeline's own fallback. Not auto-linked to an Invoice (that
 * matching is thread-based, and a manual entry has no thread).
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {object} params.extracted
 * @param {string} [params.summary]
 * @returns {Promise<{ payment: object|null, entity: object|null, error: string|null }>}
 */
async function persistPaymentFromManualEntry({ userId, extracted, summary }) {
    const paidAt = extracted?.paidAt || new Date().toISOString();

    const raw = {
        ...extracted,
        paidAt,
        sourceUrl: buildSourceUrl({ provider: 'MANUAL' }),
        sourceType: 'DOCUMENT',
        threadId: null,
        messageId: null,
        metadata: summary ? { summary } : {},
    };

    const { payment: validated, error } = validateExtractedPayment(raw);
    if (error) return { payment: null, entity: null, error };

    const payment = await Payment.create({ userId, ...validated });

    const entity = await createEntityForManualEntry({
        userId, type: 'PAYMENT', title: buildPaymentTitle(payment), entityId: payment._id,
    });

    return { payment, entity, error: null };
}

module.exports = {
    persistPayment,
    buildPaymentTitle,
    autoLinkBySameThread,
    findPaymentsByFilters,
    persistPaymentFromManualEntry,
};
