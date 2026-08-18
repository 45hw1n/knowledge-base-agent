const mongoose = require('mongoose');

/**
 * A single extracted knowledge-base entity. `entityType` and `data` are
 * intentionally schemaless — Cortex extracts whatever entity types the AI
 * identifies in a document (contact, invoice, appointment, receipt, order,
 * etc.) rather than a fixed, hardcoded set, so `data` shape varies per type.
 */
const EntitySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        entityType: {
            type: String,
            required: true,
            trim: true
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        sourceType: {
            type: String,
            enum: ['EMAIL_BODY', 'EMAIL_ATTACHMENT', 'UPLOAD'],
            required: true
        },
        sourceEmailId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DebitEmailToProcess',
            default: null
        },
        sourceAttachmentId: {
            type: String,
            default: null
        },
        rawTextSnippet: {
            type: String,
            default: null
        },
        confidence: {
            type: Number,
            default: null
        },
        status: {
            type: String,
            enum: ['EXTRACTED', 'VALIDATED', 'FAILED'],
            default: 'EXTRACTED'
        },
        extractedAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true, collection: 'entities' }
);

EntitySchema.index({ userId: 1, entityType: 1 });
EntitySchema.index({ userId: 1, sourceEmailId: 1 });

module.exports = mongoose.model('Entity', EntitySchema);
