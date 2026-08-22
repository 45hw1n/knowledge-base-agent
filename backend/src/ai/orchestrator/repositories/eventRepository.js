const Event = require('../../../models/Event');
const { validateExtractedEvent } = Event;
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { createEntityForTypedChild } = require('./entityRepository');
const { MAX_RESULTS, escapeRegExp, attachEntityMetadata } = require('./queryHelpers');

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

/**
 * Reads Events for the chat data-access layer. Event has no `status` field
 * (see Event.js) — only `dateRange` (against `startTime`) and `keyword`
 * (against `title`/`organizer.name`/`attendees[].name`) are ever
 * whitelisted for this data source. Never spreads `filters` into the Mongo
 * query — only these specific, sanitized keys are read.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {{dateRange?:{from?:Date,to?:Date}, keyword?:string}} params.filters
 * @returns {Promise<{ data: Array<object>|null, error: string|null }>}
 */
async function findEventsByFilters({ userId, filters = {} }) {
    try {
        const query = { userId };
        if (filters.dateRange) {
            query.startTime = {};
            if (filters.dateRange.from) query.startTime.$gte = filters.dateRange.from;
            if (filters.dateRange.to) query.startTime.$lte = filters.dateRange.to;
        }
        if (filters.keyword) {
            const pattern = { $regex: escapeRegExp(filters.keyword), $options: 'i' };
            query.$or = [
                { title: pattern },
                { 'organizer.name': pattern },
                { attendees: { $elemMatch: { name: pattern } } },
            ];
        }

        const events = await Event.find(query).sort({ startTime: -1 }).limit(MAX_RESULTS).lean();
        const data = await attachEntityMetadata({
            userId,
            type: 'EVENT',
            docs: events,
            mapFields: (event) => ({
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location,
                sourceUrl: event.sourceUrl,
            }),
        });
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error.message };
    }
}

module.exports = { persistEvent, findEventsByFilters };
