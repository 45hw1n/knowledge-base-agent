const mongoose = require('mongoose');
const { ENTITY_TYPES } = require('./Entity');

/**
 * Tracks a user-initiated "manually create a knowledge base entity"
 * submission from creation through async AI processing. Purely an internal
 * processing record — not user-browsable UI beyond the toast/polling flow
 * it drives. See decisions.md.
 */

const STATUSES = ['IN_PROGRESS', 'COMPLETED', 'FAILED'];

const ERROR_CODES = [
  'ORCHESTRATION_FAILED',
  'INVALID_EXTRACTION',
  'ATTACHMENT_PROCESSING_FAILED',
  'PROCESSING_FAILED',
];

const AttachmentRefSchema = new mongoose.Schema(
  {
    storageKey: { type: String, required: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    size: { type: Number, default: null },
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

const ManualIngestionItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ENTITY_TYPES,
      required: true,
    },
    // The user's free-text description — the primary extraction input.
    details: {
      type: String,
      required: true,
    },
    // AI-generated, filled once summarization runs; null while PROCESSING.
    summary: {
      type: String,
      default: null,
    },
    attachments: {
      type: [AttachmentRefSchema],
      default: [],
    },
    status: {
      type: String,
      enum: STATUSES,
      required: true,
      default: 'IN_PROGRESS',
    },
    processingStartedAt: {
      type: Date,
      default: Date.now,
    },
    processingCompletedAt: {
      type: Date,
      default: null,
    },
    // Set only on success — the Entity registry row the submission produced.
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Entity',
      default: null,
    },
    error: {
      type: ErrorSchema,
      default: null,
    },
  },
  { timestamps: true, collection: 'manualIngestionItems' }
);

ManualIngestionItemSchema.index({ userId: 1, createdAt: -1 });
// The polling endpoint looks up a batch of ids scoped to their owner and
// filtered to non-IN_PROGRESS — this compound index covers that query.
ManualIngestionItemSchema.index({ userId: 1, status: 1 });

const ManualIngestionItem = mongoose.model('ManualIngestionItem', ManualIngestionItemSchema);
module.exports = ManualIngestionItem;
module.exports.STATUSES = STATUSES;
module.exports.ERROR_CODES = ERROR_CODES;
