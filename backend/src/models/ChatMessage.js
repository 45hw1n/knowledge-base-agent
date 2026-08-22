const mongoose = require('mongoose');

/**
 * A single turn in a chat conversation — user or assistant. Named
 * `ChatMessage`, not `ConversationMessage`, for the same collision-avoidance
 * reason as ChatConversation.js. Collection name (`conversationDetails`)
 * matches the chat feature's own spec exactly; only the JS identifier
 * differs. See decisions.md.
 */

const MESSAGE_ROLES = ['user', 'assistant'];

// User messages are always effectively COMPLETED immediately (no async work
// happens for them) but the field is still set explicitly on write for
// schema symmetry — only assistant messages meaningfully transition
// PROCESSING -> COMPLETED/FAILED.
const MESSAGE_STATUSES = ['PROCESSING', 'COMPLETED', 'FAILED'];

const ERROR_CODES = [
  'CONVERSATION_NOT_FOUND',
  'INVALID_REQUEST',
  'ORCHESTRATION_FAILED',
  'INVALID_QUERY',
  'DATA_RETRIEVAL_FAILED',
  'RESPONSE_GENERATION_FAILED',
  'PROCESSING_FAILED',
];

const ENTITY_TYPES = ['TICKET', 'INVOICE', 'PAYMENT', 'EVENT', 'DOCUMENT'];

const SourceSchema = new mongoose.Schema(
  {
    // Entity._id (the top-level registry row) — NEVER the typed child
    // document's own _id. EntityDetailSheet's entityDetail(id) query on the
    // frontend is keyed on Entity._id; getting this backwards means a
    // source chip silently fails to open. See decisions.md.
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Entity',
      required: true,
    },
    displayId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ENTITY_TYPES, required: true },
  },
  { _id: false }
);

const ErrorSchema = new mongoose.Schema(
  {
    code: { type: String, enum: ERROR_CODES, required: true },
    message: { type: String, required: true },
  },
  { _id: false }
);

const ChatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatConversation',
      required: true,
    },
    // Carried directly (not resolved via a populate/$lookup into
    // ChatConversation) so the high-frequency status-poll endpoint stays a
    // single-collection query — same ownership-scoping convention every
    // other model in this app already uses (Entity/Ticket/Invoice/etc all
    // carry userId directly).
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: { type: String, enum: MESSAGE_ROLES, required: true },
    content: { type: String, default: null },
    status: {
      type: String,
      enum: MESSAGE_STATUSES,
      required: true,
      default: 'COMPLETED',
    },
    sources: { type: [SourceSchema], default: [] },
    error: { type: ErrorSchema, default: null },
  },
  { timestamps: true, collection: 'conversationDetails' }
);

ChatMessageSchema.index({ conversationId: 1, createdAt: 1 });
// The status-poll endpoint looks up one message by id, scoped to
// conversation (and userId, checked in the query) — this compound index
// means even an ownership-mismatch lookup (id exists, wrong conversation)
// still hits an index rather than a collection scan.
ChatMessageSchema.index({ conversationId: 1, _id: 1 });

const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
module.exports = ChatMessage;
module.exports.MESSAGE_ROLES = MESSAGE_ROLES;
module.exports.MESSAGE_STATUSES = MESSAGE_STATUSES;
module.exports.ERROR_CODES = ERROR_CODES;
