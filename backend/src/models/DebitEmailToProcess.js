const mongoose = require('mongoose');

const EncryptedTextSchema = new mongoose.Schema(
    {
        iv: { type: String, required: true },
        content: { type: String, required: true },
        tag: { type: String, required: true }
    },
    { _id: false }
);


const DebitEmailToProcessSchema = new mongoose.Schema({
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
    transactionType: {
        type: String,
        enum: ['DEBIT', 'CREDIT', 'UNKNOWN'],
        default: 'UNKNOWN'
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
    collection: 'debitEmailsToProcess'
});

module.exports = mongoose.model('DebitEmailToProcess', DebitEmailToProcessSchema);
