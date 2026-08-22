const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');

async function createUserMessage({ conversationId, userId, content }) {
  return ChatMessage.create({ conversationId, userId, role: 'user', content, status: 'COMPLETED' });
}

async function createProcessingAssistantMessage({ conversationId, userId }) {
  return ChatMessage.create({ conversationId, userId, role: 'assistant', content: null, status: 'PROCESSING' });
}

async function completeAssistantMessage({ messageId, content, sources }) {
  await ChatMessage.updateOne(
    { _id: messageId },
    { $set: { content, sources: sources || [], status: 'COMPLETED' } }
  );
}

async function failAssistantMessage({ messageId, code, message }) {
  await ChatMessage.updateOne(
    { _id: messageId },
    { $set: { status: 'FAILED', error: { code, message } } }
  );
}

/**
 * Fetches one message's current status, scoped to both its conversation and
 * owner — this is the polling endpoint's read path (~20 calls/message by
 * design), so it stays a single indexed lookup. Never throws.
 *
 * @returns {Promise<object|null>}
 */
async function getMessageStatus({ conversationId, messageId, userId }) {
  if (!mongoose.isValidObjectId(conversationId) || !mongoose.isValidObjectId(messageId)) {
    return null;
  }
  return ChatMessage.findOne({ _id: messageId, conversationId, userId }).lean();
}

/**
 * Structured `{role, content}[]` history for the chat orchestrator prompt —
 * capped to the last `limit` messages, chronological order, and NEVER
 * including `sources`/`error`/`status` (those aren't conversational content,
 * they're UI/processing metadata). `excludeMessageId` omits the just-saved
 * current-turn user message, since it's already passed separately as the
 * orchestrator's `input` — including it here too would duplicate it in the
 * prompt.
 *
 * @param {object} params
 * @param {string|ObjectId} params.conversationId
 * @param {string|ObjectId} [params.excludeMessageId]
 * @param {number} params.limit
 * @returns {Promise<Array<{role:string, content:string}>>}
 */
async function getHistoryForOrchestrator({ conversationId, excludeMessageId, limit }) {
  const query = { conversationId, status: { $ne: 'PROCESSING' } };
  if (excludeMessageId) query._id = { $ne: excludeMessageId };

  const messages = await ChatMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('role content')
    .lean();

  return messages.reverse().map((message) => ({ role: message.role, content: message.content }));
}

/**
 * Full ordered transcript for a conversation — feeds the frontend's
 * ChatPanel on navigation/refresh (the Zustand store is memory-only).
 */
async function listMessages({ conversationId, userId }) {
  const messages = await ChatMessage.find({ conversationId, userId }).sort({ createdAt: 1 }).lean();
  return messages.map((message) => ({
    messageId: message._id,
    role: message.role,
    content: message.content,
    status: message.status,
    sources: message.sources,
    error: message.error,
    createdAt: message.createdAt,
  }));
}

module.exports = {
  createUserMessage,
  createProcessingAssistantMessage,
  completeAssistantMessage,
  failAssistantMessage,
  getMessageStatus,
  getHistoryForOrchestrator,
  listMessages,
};
