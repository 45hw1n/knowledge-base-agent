const mongoose = require('mongoose');
const ChatConversation = require('../models/ChatConversation');
const aiClient = require('../ai/client');
const { buildTitlePrompt } = require('../ai/chatOrchestrator/prompts/titlePrompt');

const TITLE_MAX_LENGTH = 60;

function truncateTitle(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 'New conversation';
  return trimmed.length > TITLE_MAX_LENGTH ? `${trimmed.slice(0, TITLE_MAX_LENGTH)}…` : trimmed;
}

async function create({ userId }) {
  return ChatConversation.create({ userId, title: 'New conversation' });
}

/**
 * Fetches a conversation scoped to its owner. Never throws — an invalid
 * ObjectId string is treated the same as "not found," not a 500.
 *
 * @returns {Promise<{ conversation: object|null, error: string|null }>}
 */
async function getOwnedOrError({ conversationId, userId }) {
  if (!mongoose.isValidObjectId(conversationId)) {
    return { conversation: null, error: 'Conversation not found' };
  }
  const conversation = await ChatConversation.findOne({ _id: conversationId, userId });
  if (!conversation) {
    return { conversation: null, error: 'Conversation not found' };
  }
  return { conversation, error: null };
}

/**
 * Generates a short title from the conversation's first message and saves
 * it. Runs detached from the request/response cycle (see chatController.js)
 * — any failure here (AI call throws, empty/malformed response) falls back
 * to a truncated version of the input itself rather than failing the whole
 * turn; title generation is never allowed to block or fail message
 * processing.
 */
async function generateTitle({ conversationId, input }) {
  let title;
  try {
    const raw = await aiClient.generate(buildTitlePrompt(input), { feature: 'chatTitle' });
    title = truncateTitle(String(raw).replace(/^["'“”]|["'“”]$/g, ''));
  } catch (error) {
    console.error(`[chatConversationService] Title generation failed, falling back to truncated input:`, error.message);
    title = truncateTitle(input);
  }

  await ChatConversation.updateOne({ _id: conversationId }, { $set: { title } });
  return title;
}

async function touchUpdatedAt(conversationId) {
  await ChatConversation.updateOne({ _id: conversationId }, { $set: { updatedAt: new Date() } });
}

async function listForUser({ userId }) {
  const conversations = await ChatConversation.find({ userId }).sort({ updatedAt: -1 }).lean();
  return conversations.map((conversation) => ({
    conversationId: conversation._id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  }));
}

module.exports = { create, getOwnedOrError, generateTitle, touchUpdatedAt, listForUser };
