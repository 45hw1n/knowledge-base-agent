const Invoice = require('../models/Invoice');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { parseFromHeader } = require('../utils/parseEmailAddress');
const { validateConversationMessage } = require('../models/schemas/ConversationMessageSchema');

const CONVERSATION_MODELS = [
    { type: 'INVOICE', Model: Invoice },
    { type: 'TICKET', Model: Ticket },
];

/**
 * Builds a single validated conversation message from plain (already
 * decrypted) fields. Shared by:
 *  - entityRepository.js#buildInitialConversationMessage — the FIRST
 *    message, seeded when a new Invoice/Ticket is created.
 *  - syncEmailsService.js's thread-reconciliation check — a LATER reply,
 *    appended to an already-existing Invoice/Ticket on the same thread.
 * so sender-parsing/direction-derivation/validation logic lives in exactly
 * one place regardless of when in the pipeline it runs. See decisions.md.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {string} params.messageId
 * @param {string} params.fromHeader - raw "From" header value
 * @param {string} params.bodyText - plain-text email body
 * @param {string|Date|null} params.date
 * @param {Array<{attachmentId: string, filename?: string, fileName?: string, mimeType?: string, size?: number}>} [params.attachments]
 * @returns {Promise<{ message: object|null, error: string|null }>}
 */
async function buildConversationMessage({ userId, messageId, fromHeader, bodyText, date, attachments = [] }) {
    const sender = parseFromHeader(fromHeader || '');

    const owner = await User.findById(userId).select('email').lean();
    const ownerEmail = owner?.email ? owner.email.trim().toLowerCase() : null;
    const direction = sender.email && ownerEmail && sender.email === ownerEmail ? 'SENT' : 'RECEIVED';

    const parsedDate = date ? new Date(date) : new Date();
    const timestamp = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    return validateConversationMessage({
        messageId,
        direction,
        content: bodyText || '',
        timestamp,
        attachments: (attachments || []).map((a) => ({
            attachmentId: a.attachmentId,
            fileName: a.filename || a.fileName,
            mimeType: a.mimeType,
            size: a.size,
        })),
        sender,
    });
}

/**
 * Finds the (at most one) Invoice or Ticket this user already owns on the
 * given Gmail thread — the cheap, deterministic half of "is this reply part
 * of an existing conversation" (see decisions.md's Scenario 4). Checks
 * Invoice before Ticket; if a thread somehow has both, the first one found
 * wins — an edge case, not expected in practice.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {string} params.threadId
 * @returns {Promise<{ type: string, doc: import('mongoose').Document } | null>}
 */
async function findExistingConversationEntity({ userId, threadId }) {
    if (!threadId) return null;

    for (const { type, Model } of CONVERSATION_MODELS) {
        const doc = await Model.findOne({ userId, threadId });
        if (doc) return { type, doc };
    }
    return null;
}

/**
 * Appends a new message to an existing Invoice/Ticket's conversation[].
 * Idempotent: the update filter excludes documents that already have a
 * conversation entry with this messageId, so a duplicate webhook delivery
 * or retried sync can't append the same reply twice — same reasoning as
 * EmailToProcess's unique messageId index, applied to an array field
 * instead of a collection.
 *
 * @param {object} params
 * @param {string} params.type - 'INVOICE' | 'TICKET'
 * @param {import('mongoose').Document} params.doc
 * @param {object} params.message - an already-validated ConversationMessage
 * @returns {Promise<boolean>} true if appended, false if it was already present
 */
async function appendConversationMessage({ type, doc, message }) {
    const Model = type === 'INVOICE' ? Invoice : Ticket;

    const result = await Model.updateOne(
        { _id: doc._id, 'conversation.messageId': { $ne: message.messageId } },
        { $push: { conversation: message } }
    );

    return result.modifiedCount > 0;
}

module.exports = { buildConversationMessage, findExistingConversationEntity, appendConversationMessage };
