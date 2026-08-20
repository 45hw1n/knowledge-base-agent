const mongoose = require('mongoose');
const { ENTITY_TYPES } = require('../classifier/classifier');

const EncryptedTextSchema = new mongoose.Schema(
    {
        iv: { type: String, required: true },
        content: { type: String, required: true },
        tag: { type: String, required: true }
    },
    { _id: false }
);


const EmailToProcessSchema = new mongoose.Schema({
    accountUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    threadId: String,
    from: { type: EncryptedTextSchema },
    subject: { type: EncryptedTextSchema },
    date: String,
    snippet: { type: EncryptedTextSchema },
    encryptedCleanText: {
        type: EncryptedTextSchema,
        required: true
    },
    bodyHash: {
        type: String
    },
    attachments: {
        type: [
            {
                attachmentId: { type: String, required: true },
                filename: { type: String, required: true },
                mimeType: { type: String, required: true },
                size: { type: Number, default: null }
            }
        ],
        default: [],
        _id: false
    },
    // The classifier's candidate list for this email (see
    // classifier/classifier.js) — persisted at ingestion time so the
    // orchestrator doesn't need to reclassify. An email is only ever
    // persisted here once classify() has returned at least one candidate;
    // this field is never empty on a stored record.
    classification: {
        candidates: {
            type: [
                {
                    type: { type: String, enum: ENTITY_TYPES, required: true },
                    score: { type: Number, required: true },
                    matchedRules: { type: [String], default: [] }
                }
            ],
            default: [],
            _id: false
        }
    },
    source: {
        type: String,
        enum: ['email'],
        default: 'email'
    },
    status: {
        type: String,
        enum: ['DETECTED', 'PROCESSING', 'LLM_PROCESSED', 'LLM_ERROR', 'REJECTED', 'RETRY_PENDING', 'FAILED'],
        default: 'DETECTED'
    },
    LLMProcessedAt: {
        type: Date,
        default: null
    },
    LLMError: {
        type: String,
        default: null
    },
    _processed_result: {
        type: mongoose.Schema.Types.Mixed
    },
    LLMProcessCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '30d'
    }
}, {
    collection: 'emailsToProcess'
});

module.exports = mongoose.model('EmailToProcess', EmailToProcessSchema);
