const mongoose = require('mongoose');

/**
 * A chat conversation's metadata (title + timestamps only) — the actual
 * messages live in ChatMessage. Named `ChatConversation`, not `Conversation`,
 * to avoid colliding with the unrelated existing `conversationService.js` /
 * `ConversationMessageSchema.js` (email reply-thread capture embedded in
 * Ticket/Invoice.conversation[] — a completely different feature). The
 * collection name still matches the chat feature's own spec exactly. See
 * decisions.md.
 */
const ChatConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Set to a real value once the async title-generation step completes;
    // never blocks the initial response on that AI call.
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'New conversation',
    },
  },
  { timestamps: true, collection: 'conversations' }
);

ChatConversationSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('ChatConversation', ChatConversationSchema);
