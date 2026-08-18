const mongoose = require('mongoose');

/**
 * A conversation thread — one or more related email messages (an original
 * message plus its replies). Distinct from a KnowledgeObject: a thread
 * preserves conversational context (who said what, in what order); a
 * KnowledgeObject represents the durable knowledge eventually extracted
 * from it. Not every thread has one yet, and — per the current scope — a
 * thread links to at most one primary KnowledgeObject, though the schema
 * doesn't hard-code that as a limit (see decisions.md).
 */
const ParticipantSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, default: null },
  },
  { _id: false }
);

const EmailThreadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: String,
      enum: ['GMAIL'],
      default: 'GMAIL',
      required: true,
    },
    // The provider's own stable conversation identifier (Gmail's threadId).
    // Preferred over any subject-based matching whenever the provider
    // supplies one — see decisions.md.
    providerThreadId: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      default: '',
    },
    participants: {
      type: [ParticipantSchema],
      default: [],
    },
    // Provider message IDs belonging to this thread, in the order first seen.
    messageIds: {
      type: [String],
      default: [],
    },
    knowledgeObjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KnowledgeObject',
      default: null,
    },
  },
  { timestamps: true, collection: 'email_threads' }
);

// Uniqueness boundary: (userId, provider, providerThreadId) rather than just
// (provider, providerThreadId) — Gmail thread IDs are only guaranteed unique
// within a single mailbox, so scoping globally would risk merging two
// different users' threads if their IDs ever collided. See decisions.md.
EmailThreadSchema.index({ userId: 1, provider: 1, providerThreadId: 1 }, { unique: true });

module.exports = mongoose.model('EmailThread', EmailThreadSchema);
