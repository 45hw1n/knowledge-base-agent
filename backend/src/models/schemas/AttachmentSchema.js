const mongoose = require('mongoose');

/**
 * Reusable attachment sub-schema, embedded into any entity that supports
 * attachments (TransactionsToReview today; Transaction, RecurringPayment,
 * etc. later). Do NOT create per-entity copies of this schema.
 */
const AttachmentSchema = new mongoose.Schema(
    {
        storageKey: {
            type: String,
            required: true
        },
        fileName: {
            type: String,
            required: true
        },
        mimeType: {
            type: String,
            required: true
        },
        size: {
            type: Number,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        _id: true,
        toJSON: {
            virtuals: true,
            versionKey: false,
            transform: function (doc, ret) {
                ret.id = ret._id.toString();
                delete ret._id;
            }
        },
        toObject: {
            virtuals: true,
            versionKey: false,
            transform: function (doc, ret) {
                ret.id = ret._id.toString();
                delete ret._id;
            }
        }
    }
);

module.exports = AttachmentSchema;
