const mongoose = require('mongoose');
const AttachmentRefSchema = require('./AttachmentRefSchema');

/**
 * A single preserved message relevant to an entity's conversation (Invoice,
 * Ticket) — NOT a full email-thread sync, just enough context to explain a
 * status change (e.g. the message that triggered PAID, or the reply that
 * resolved a Ticket). Shared because Invoice and Ticket both need the
 * identical shape — see decisions.md.
 *
 * `direction` is intentionally SENT/RECEIVED, not a `fromUser: boolean` —
 * see decisions.md. `attachments` belongs HERE, per message — not as a
 * separate top-level field on the owning entity — because an attachment is
 * a fact about one specific email in the conversation, not about the
 * entity as a whole.
 */
const CONVERSATION_DIRECTIONS = ['SENT', 'RECEIVED'];

const ConversationMessageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true },
    direction: { type: String, enum: CONVERSATION_DIRECTIONS, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true },
    attachments: { type: [AttachmentRefSchema], default: [] },
  },
  { _id: false }
);

/**
 * Validates and normalizes a single reply message before it's appended to
 * an entity's `conversation[]` (Invoice or Ticket). Never throws — returns
 * `{ message: null, error }` on malformed input, mirroring every other
 * validateExtracted*-style function in this codebase.
 *
 * @param {object} raw
 * @returns {{ message: object|null, error: string|null }}
 */
function validateConversationMessage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { message: null, error: 'Conversation message must be an object' };
  }

  const messageId = typeof raw.messageId === 'string' ? raw.messageId.trim() : '';
  if (!messageId) {
    return { message: null, error: 'Conversation message is missing a required "messageId"' };
  }

  if (!CONVERSATION_DIRECTIONS.includes(raw.direction)) {
    return { message: null, error: `Conversation message has an invalid "direction": ${raw.direction}` };
  }

  const content = typeof raw.content === 'string' ? raw.content : '';
  if (!content) {
    return { message: null, error: 'Conversation message is missing required "content"' };
  }

  const timestamp = raw.timestamp ? new Date(raw.timestamp) : null;
  if (!timestamp || Number.isNaN(timestamp.getTime())) {
    return { message: null, error: 'Conversation message is missing a valid required "timestamp"' };
  }

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .filter((a) => a && typeof a.attachmentId === 'string' && typeof a.fileName === 'string')
        .map((a) => ({ attachmentId: a.attachmentId, fileName: a.fileName }))
    : [];

  return {
    message: { messageId, direction: raw.direction, content, timestamp, attachments },
    error: null,
  };
}

module.exports = ConversationMessageSchema;
module.exports.CONVERSATION_DIRECTIONS = CONVERSATION_DIRECTIONS;
module.exports.validateConversationMessage = validateConversationMessage;
