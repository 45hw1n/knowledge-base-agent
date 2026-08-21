const Event = require('../../../models/Event');
const { validateExtractedEvent } = Event;
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { createEntityForTypedChild } = require('./entityRepository');

/**
 * Persists an extracted Event and its Entity row. Idempotent on
 * (userId, messageId) — same reasoning as invoiceRepository.js.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {import('mongoose').Document} params.emailDoc
 * @param {object} params.extracted - structured fields from documentProcessor/structuredExtraction
 * @param {string} [params.summary] - from textSummaryProcessor
 * @param {string|null} [params.aiModel]
 * @returns {Promise<{ event: object|null, entity: object|null, error: string|null }>}
 */
async function persistEvent({ userId, emailDoc, extracted, summary, aiModel = null }) {
    const existing = await Event.findOne({ userId, messageId: emailDoc.messageId });
    if (existing) {
        const entity = await createEntityForTypedChild({
            userId, type: 'EVENT', title: existing.title, entityId: existing._id, emailDoc, aiModel,
        });
        return { event: existing, entity, error: null };
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

    const { event: validated, error } = validateExtractedEvent(raw);
    if (error) return { event: null, entity: null, error };

    let event;
    try {
        event = await Event.create({ userId, ...validated });
    } catch (createError) {
        if (createError.code === 11000) {
            event = await Event.findOne({ userId, messageId: emailDoc.messageId });
        } else {
            throw createError;
        }
    }

    const entity = await createEntityForTypedChild({
        userId, type: 'EVENT', title: event.title, entityId: event._id, emailDoc, aiModel,
    });

    return { event, entity, error: null };
}

module.exports = { persistEvent };
