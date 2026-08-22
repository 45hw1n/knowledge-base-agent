const config = require('../config');
const chatConversationService = require('../services/chatConversationService');
const chatMessageService = require('../services/chatMessageService');
const { orchestrateChatTurn } = require('../ai/chatOrchestrator');

/**
 * Runs the AI pipeline for a turn and writes the final status. Always
 * called detached from the request/response cycle (fire-and-forget, same
 * pattern as webhookController.js's processNotificationAsync) — the two
 * POST endpoints below have already responded by the time this runs, so
 * any error here can only ever be persisted, never surfaced as an HTTP
 * response. A thrown error not already wrapped in one of the orchestrator's
 * own error codes falls back to PROCESSING_FAILED.
 */
async function runTurnAndPersist({ userId, input, history, assistantMessageId }) {
  try {
    const { message, sources, error } = await orchestrateChatTurn({ userId, input, history });
    if (error) {
      await chatMessageService.failAssistantMessage({ messageId: assistantMessageId, ...error });
      return;
    }
    await chatMessageService.completeAssistantMessage({ messageId: assistantMessageId, content: message, sources });
  } catch (error) {
    await chatMessageService.failAssistantMessage({
      messageId: assistantMessageId,
      code: 'PROCESSING_FAILED',
      message: error.message,
    });
  }
}

async function processNewConversationAsync({ conversationId, userId, input, assistantMessageId }) {
  await chatConversationService.generateTitle({ conversationId, input });
  await runTurnAndPersist({ userId, input, history: [], assistantMessageId });
  await chatConversationService.touchUpdatedAt(conversationId);
}

async function processExistingConversationAsync({ conversationId, userId, input, history, assistantMessageId }) {
  await runTurnAndPersist({ userId, input, history, assistantMessageId });
  await chatConversationService.touchUpdatedAt(conversationId);
}

function requireInput(req, res) {
  const input = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
  if (!input) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: '"input" is required and must be a non-empty string' } });
    return null;
  }
  return input;
}

// POST /api/conversations — new conversation. `conversationId` is always
// null here per spec; the endpoint's existence itself signals "new," so the
// body only needs `input`. A `type` field, if the frontend sends one, is
// never read — conversationId (here, its absence) is the sole indicator.
async function createConversation(req, res) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } });

  const input = requireInput(req, res);
  if (!input) return;

  const userId = req.user._id;
  const conversation = await chatConversationService.create({ userId });
  await chatMessageService.createUserMessage({ conversationId: conversation._id, userId, content: input });
  const assistantMessage = await chatMessageService.createProcessingAssistantMessage({ conversationId: conversation._id, userId });

  res.status(201).json({ conversationId: conversation._id, messageId: assistantMessage._id, status: 'PROCESSING' });

  processNewConversationAsync({
    conversationId: conversation._id,
    userId,
    input,
    assistantMessageId: assistantMessage._id,
  }).catch((error) => console.error('[chatController] Unhandled error in async chat processing:', error));
}

// POST /api/conversations/:conversationId/messages — existing conversation.
// Backend keys off the URL's :conversationId, never a `type` field the
// frontend may or may not send.
async function postMessage(req, res) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } });

  const { conversationId } = req.params;
  const userId = req.user._id;

  const { conversation, error: notFoundError } = await chatConversationService.getOwnedOrError({ conversationId, userId });
  if (notFoundError) {
    return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: notFoundError } });
  }

  const input = requireInput(req, res);
  if (!input) return;

  const userMessage = await chatMessageService.createUserMessage({ conversationId: conversation._id, userId, content: input });
  const history = await chatMessageService.getHistoryForOrchestrator({
    conversationId: conversation._id,
    excludeMessageId: userMessage._id,
    limit: config.chat.historyTurnLimit,
  });
  const assistantMessage = await chatMessageService.createProcessingAssistantMessage({ conversationId: conversation._id, userId });

  res.status(201).json({ conversationId: conversation._id, messageId: assistantMessage._id, status: 'PROCESSING' });

  // Title is deliberately never regenerated for an existing conversation.
  processExistingConversationAsync({
    conversationId: conversation._id,
    userId,
    input,
    history,
    assistantMessageId: assistantMessage._id,
  }).catch((error) => console.error('[chatController] Unhandled error in async chat processing:', error));
}

// GET /api/conversations/:conversationId/messages/:messageId/status — the
// short-polling endpoint. The backend is the sole source of truth for
// status; this never reflects anything the frontend decided on its own
// (e.g. a frontend-side TIMEOUT is never written back here).
async function getMessageStatus(req, res) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } });

  const { conversationId, messageId } = req.params;
  const message = await chatMessageService.getMessageStatus({ conversationId, messageId, userId: req.user._id });
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  if (message.status === 'PROCESSING') {
    return res.json({ status: 'PROCESSING' });
  }
  if (message.status === 'FAILED') {
    return res.json({ status: 'FAILED', error: message.error });
  }
  return res.json({ status: 'COMPLETED', message: message.content, sources: message.sources });
}

// GET /api/conversations — list, feeds the history sidebar.
async function listConversations(req, res) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } });
  const conversations = await chatConversationService.listForUser({ userId: req.user._id });
  res.json(conversations);
}

// GET /api/conversations/:conversationId/messages — full transcript, feeds
// the chat panel on navigation/refresh.
async function getMessages(req, res) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } });

  const { conversationId } = req.params;
  const userId = req.user._id;
  const { error: notFoundError } = await chatConversationService.getOwnedOrError({ conversationId, userId });
  if (notFoundError) {
    return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: notFoundError } });
  }

  const messages = await chatMessageService.listMessages({ conversationId, userId });
  res.json(messages);
}

module.exports = { createConversation, postMessage, getMessageStatus, listConversations, getMessages };
