const Document = require('../../../models/Document');
const { validateExtractedDocument } = Document;
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { createEntityForTypedChild } = require('./entityRepository');

/**
 * Persists an extracted Document and its Entity row. Idempotent on
 * (userId, messageId) — same reasoning as invoiceRepository.js.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {import('mongoose').Document} params.emailDoc
 * @param {object} params.extracted - structured fields from documentProcessor/structuredExtraction
 * @param {string} [params.summary] - from textSummaryProcessor
 * @param {string|null} [params.aiModel]
 * @returns {Promise<{ document: object|null, entity: object|null, error: string|null }>}
 */
async function persistDocument({ userId, emailDoc, extracted, summary, aiModel = null }) {
    const existing = await Document.findOne({ userId, messageId: emailDoc.messageId });
    if (existing) {
        const entity = await createEntityForTypedChild({
            userId, type: 'DOCUMENT', title: existing.title, entityId: existing._id, emailDoc, aiModel,
        });
        return { document: existing, entity, error: null };
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

    const { document: validated, error } = validateExtractedDocument(raw);
    if (error) return { document: null, entity: null, error };

    let document;
    try {
        document = await Document.create({ userId, ...validated });
    } catch (createError) {
        if (createError.code === 11000) {
            document = await Document.findOne({ userId, messageId: emailDoc.messageId });
        } else {
            throw createError;
        }
    }

    const entity = await createEntityForTypedChild({
        userId, type: 'DOCUMENT', title: document.title, entityId: document._id, emailDoc, aiModel,
    });

    return { document, entity, error: null };
}

module.exports = { persistDocument };
