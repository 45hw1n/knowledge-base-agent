const Ticket = require('../../../models/Ticket');
const { validateExtractedTicket } = Ticket;
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { createEntityForTypedChild, buildInitialConversationMessage } = require('./entityRepository');

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

module.exports = { persistTicket };
