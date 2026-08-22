const Entity = require('../../../models/Entity');
const { generateDisplayId } = require('../../../services/displayIdService');
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { findOrCreateThread } = require('../../../services/threadService');
const { decryptClearText } = require('../../../utils/emailEncryption');
const { buildConversationMessage } = require('../../../services/conversationService');

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

/**
 * Builds the first `conversation[]` entry for a freshly-created Invoice/
 * Ticket from the email that triggered its extraction — shared by
 * invoiceRepository.js/ticketRepository.js since the shape and rules are
 * identical for both. Never throws; returns `null` if there's nothing
 * usable to record (e.g. an undecryptable/empty body), in which case the
 * caller simply gets an empty `conversation[]`, same as before this existed.
 *
 * `direction` is a real comparison, not a guess: RECEIVED unless the
 * email's own `From` address matches the account owner's email.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {import('mongoose').Document} params.emailDoc - an EmailToProcess record
 * @returns {Promise<object|null>}
 */
async function buildInitialConversationMessage({ userId, emailDoc }) {
    let fromHeader = '';
    try {
        fromHeader = emailDoc.from ? decryptClearText(emailDoc.from) || '' : '';
    } catch (error) {
        console.error(`[entityRepository] Failed to decrypt From header for messageId=${emailDoc.messageId}:`, error.message);
    }

    let bodyText = '';
    try {
        bodyText = emailDoc.encryptedCleanText ? decryptClearText(emailDoc.encryptedCleanText) || '' : '';
    } catch (error) {
        console.error(`[entityRepository] Failed to decrypt body for messageId=${emailDoc.messageId}:`, error.message);
    }

    const { message, error } = await buildConversationMessage({
        userId,
        messageId: emailDoc.messageId,
        fromHeader,
        bodyText,
        date: emailDoc.date,
        attachments: emailDoc.attachments || [],
    });

    if (error) {
        console.warn(`[entityRepository] Skipping initial conversation message for messageId=${emailDoc.messageId}: ${error}`);
        return null;
    }

    return message;
}

module.exports = { createEntityForTypedChild, buildInitialConversationMessage };
