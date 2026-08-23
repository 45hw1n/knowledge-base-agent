const Document = require('../../../models/Document');
const { validateExtractedDocument } = Document;
const { buildSourceUrl } = require('../../../services/sourceUrlService');
const { createEntityForTypedChild, createEntityForManualEntry } = require('./entityRepository');
const { MAX_RESULTS, escapeRegExp, attachEntityMetadata } = require('./queryHelpers');

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

/**
 * Reads Documents for the chat data-access layer. Filters on `type`
 * (Document's own DOCUMENT_TYPES enum, unlike Ticket/Invoice which filter
 * on `status`), `effectiveDateRange`/`expiryDateRange`, and `keyword`
 * (against `title`/`issuer.name`/`parties[].name`). Never spreads `filters`
 * into the Mongo query — only these specific, sanitized keys are read.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {{type?:string, effectiveDateRange?:{from?:Date,to?:Date}, expiryDateRange?:{from?:Date,to?:Date}, keyword?:string}} params.filters
 * @returns {Promise<{ data: Array<object>|null, error: string|null }>}
 */
async function findDocumentsByFilters({ userId, filters = {} }) {
    try {
        const query = { userId };
        if (filters.type) query.type = filters.type;
        if (filters.effectiveDateRange) {
            query.effectiveDate = {};
            if (filters.effectiveDateRange.from) query.effectiveDate.$gte = filters.effectiveDateRange.from;
            if (filters.effectiveDateRange.to) query.effectiveDate.$lte = filters.effectiveDateRange.to;
        }
        if (filters.expiryDateRange) {
            query.expiryDate = {};
            if (filters.expiryDateRange.from) query.expiryDate.$gte = filters.expiryDateRange.from;
            if (filters.expiryDateRange.to) query.expiryDate.$lte = filters.expiryDateRange.to;
        }
        if (filters.keyword) {
            const pattern = { $regex: escapeRegExp(filters.keyword), $options: 'i' };
            query.$or = [
                { title: pattern },
                { 'issuer.name': pattern },
                { parties: { $elemMatch: { name: pattern } } },
            ];
        }

        const documents = await Document.find(query).sort({ createdAt: -1 }).limit(MAX_RESULTS).lean();
        const data = await attachEntityMetadata({
            userId,
            type: 'DOCUMENT',
            docs: documents,
            mapFields: (document) => ({
                documentType: document.type,
                effectiveDate: document.effectiveDate,
                expiryDate: document.expiryDate,
                sourceUrl: document.sourceUrl,
            }),
        });
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error.message };
    }
}

/**
 * Persists a Document from the manual "Create Knowledge" flow — see
 * ticketRepository.js's persistTicketFromManualEntry for the shared
 * reasoning. Unlike Ticket/Invoice/Payment/Event, Document.attachments
 * (models/schemas/AttachmentRefSchema.js: {attachmentId, fileName,
 * mimeType, size}) is a genuine reference to a raw uploaded file — not a
 * cross-reference to another entity — so uploaded attachments ARE copied
 * onto the created Document, using their R2 storage key as attachmentId.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {object} params.extracted
 * @param {string} [params.summary]
 * @param {Array<{storageKey:string, fileName:string, mimeType:string, size:number}>} [params.attachmentRefs]
 * @returns {Promise<{ document: object|null, entity: object|null, error: string|null }>}
 */
async function persistDocumentFromManualEntry({ userId, extracted, summary, attachmentRefs = [] }) {
    const raw = {
        ...extracted,
        sourceUrl: buildSourceUrl({ provider: 'MANUAL' }),
        sourceType: 'DOCUMENT',
        threadId: null,
        messageId: null,
        metadata: summary ? { summary } : {},
        attachments: attachmentRefs.map((ref) => ({
            attachmentId: ref.storageKey,
            fileName: ref.fileName,
            mimeType: ref.mimeType,
            size: ref.size,
        })),
    };

    const { document: validated, error } = validateExtractedDocument(raw);
    if (error) return { document: null, entity: null, error };

    const document = await Document.create({ userId, ...validated });

    const entity = await createEntityForManualEntry({
        userId, type: 'DOCUMENT', title: document.title, entityId: document._id,
    });

    return { document, entity, error: null };
}

module.exports = { persistDocument, findDocumentsByFilters, persistDocumentFromManualEntry };
