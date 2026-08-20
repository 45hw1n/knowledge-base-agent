const Entity = require('../../../models/Entity');
const { generateDisplayId } = require('../../../services/displayIdService');
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { findOrCreateThread } = require('../../../services/threadService');

/**
 * Creates the Entity registry row for a typed child that already exists
 * (Invoice/Payment/Ticket/Event/Document) — shared across all five type
 * repositories rather than duplicated, since displayId generation, source
 * URL construction, and thread lookup are identical regardless of type.
 * See decisions.md.
 *
 * Idempotent on `entityId` (via the unique+sparse index on Entity.entityId):
 * if a retried extraction reaches here after an earlier attempt already
 * created the Entity row for this exact typed child, this returns the
 * existing row instead of creating a duplicate.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {string} params.type - one of Entity.ENTITY_TYPES
 * @param {string} params.title
 * @param {ObjectId} params.entityId - the typed child's _id
 * @param {import('mongoose').Document} params.emailDoc - the source EmailToProcess record
 * @param {string|null} [params.aiModel]
 * @param {number|null} [params.confidence]
 * @returns {Promise<import('mongoose').Document>}
 */
async function createEntityForTypedChild({ userId, type, title, entityId, emailDoc, aiModel = null, confidence = null }) {
    const existing = await Entity.findOne({ entityId });
    if (existing) return existing;

    const sourceUrl = buildSourceUrl({ provider: 'GMAIL', messageId: emailDoc.messageId });

    const thread = await findOrCreateThread({
        userId,
        provider: 'GMAIL',
        providerThreadId: emailDoc.threadId,
        providerMessageId: emailDoc.messageId,
    });

    const displayId = await generateDisplayId({ userId, type });

    try {
        return await Entity.create({
            userId,
            type,
            displayId,
            title,
            source: {
                type: 'EMAIL',
                provider: 'GMAIL',
                url: sourceUrl,
                emailId: emailDoc._id,
                threadId: thread._id,
            },
            entityId,
            extraction: {
                status: 'SUCCESS',
                model: aiModel,
                confidence,
                extractedAt: new Date(),
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            // Raced with another worker that created this Entity row first
            // (e.g. a concurrent retry after a stale-PROCESSING reclaim).
            return Entity.findOne({ entityId });
        }
        throw error;
    }
}

module.exports = { createEntityForTypedChild };
