const Ticket = require('../../../models/Ticket');
const { validateExtractedTicket } = Ticket;
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { createEntityForTypedChild, buildInitialConversationMessage, createEntityForManualEntry } = require('./entityRepository');
const { MAX_RESULTS, escapeRegExp, attachEntityMetadata } = require('./queryHelpers');

/**
 * Persists an extracted Ticket and its Entity row. Idempotent on
 * (userId, messageId) — same reasoning as invoiceRepository.js.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {import('mongoose').Document} params.emailDoc
 * @param {object} params.extracted - structured fields from documentProcessor/structuredExtraction
 * @param {string} [params.summary] - from textSummaryProcessor
 * @param {string|null} [params.aiModel]
 * @returns {Promise<{ ticket: object|null, entity: object|null, error: string|null }>}
 */
async function persistTicket({ userId, emailDoc, extracted, summary, aiModel = null }) {
    const existing = await Ticket.findOne({ userId, messageId: emailDoc.messageId });
    if (existing) {
        const entity = await createEntityForTypedChild({
            userId, type: 'TICKET', title: existing.title, entityId: existing._id, emailDoc, aiModel,
        });
        return { ticket: existing, entity, error: null };
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

    const { ticket: validated, error } = validateExtractedTicket(raw);
    if (error) return { ticket: null, entity: null, error };

    let ticket;
    try {
        ticket = await Ticket.create({ userId, ...validated });
    } catch (createError) {
        if (createError.code === 11000) {
            ticket = await Ticket.findOne({ userId, messageId: emailDoc.messageId });
        } else {
            throw createError;
        }
    }

    const entity = await createEntityForTypedChild({
        userId, type: 'TICKET', title: ticket.title, entityId: ticket._id, emailDoc, aiModel,
    });

    return { ticket, entity, error: null };
}

/**
 * Reads Tickets for the chat data-access layer. Never spreads `filters`
 * into the Mongo query — only the specific, sanitized keys the chat
 * orchestrator's filterSanitizers.js already validated are ever read here.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {{status?:string, urgency?:string, priority?:string, dateRange?:{from?:Date,to?:Date}, keyword?:string}} params.filters
 * @returns {Promise<{ data: Array<object>|null, error: string|null }>}
 */
async function findTicketsByFilters({ userId, filters = {} }) {
    try {
        const query = { userId };
        if (filters.status) query.status = filters.status;
        if (filters.urgency) query.urgency = filters.urgency;
        if (filters.priority) query.priority = filters.priority;
        if (filters.dateRange) {
            query.createdAt = {};
            if (filters.dateRange.from) query.createdAt.$gte = filters.dateRange.from;
            if (filters.dateRange.to) query.createdAt.$lte = filters.dateRange.to;
        }
        if (filters.keyword) {
            query.title = { $regex: escapeRegExp(filters.keyword), $options: 'i' };
        }

        const tickets = await Ticket.find(query).sort({ createdAt: -1 }).limit(MAX_RESULTS).lean();
        const data = await attachEntityMetadata({
            userId,
            type: 'TICKET',
            docs: tickets,
            mapFields: (ticket) => ({
                status: ticket.status,
                urgency: ticket.urgency,
                priority: ticket.priority,
                dueDate: ticket.dueDate,
                sourceUrl: ticket.sourceUrl,
            }),
        });
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error.message };
    }
}

/**
 * Persists a Ticket from the manual "Create Knowledge" flow — no emailDoc,
 * no messageId to key an idempotency lookup on (every submission is a new
 * record), sourceType DOCUMENT, no conversation seed. See
 * manualIngestionOrchestrator/index.js and decisions.md.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {object} params.extracted - merged structured fields (details text + attachments)
 * @param {string} [params.summary]
 * @returns {Promise<{ ticket: object|null, entity: object|null, error: string|null }>}
 */
async function persistTicketFromManualEntry({ userId, extracted, summary }) {
    const raw = {
        ...extracted,
        sourceUrl: buildSourceUrl({ provider: 'MANUAL' }),
        sourceType: 'DOCUMENT',
        threadId: null,
        messageId: null,
        metadata: summary ? { summary } : {},
    };

    const { ticket: validated, error } = validateExtractedTicket(raw);
    if (error) return { ticket: null, entity: null, error };

    const ticket = await Ticket.create({ userId, ...validated });

    const entity = await createEntityForManualEntry({
        userId, type: 'TICKET', title: ticket.title, entityId: ticket._id,
    });

    return { ticket, entity, error: null };
}

module.exports = { persistTicket, findTicketsByFilters, persistTicketFromManualEntry };
