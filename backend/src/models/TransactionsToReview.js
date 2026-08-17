const mongoose = require('mongoose');
const AttachmentSchema = require('./schemas/AttachmentSchema');

/**
 * Generic selectable field (category, subCategory, paymentMode)
 */
const FieldValueSchema = new mongoose.Schema(
    {
        id: String,
        value: String,
        label: String
    },
    { _id: false }
);

/**
 * Controlled polymorphic payment instrument
 */
const PaymentInstrumentSchema = new mongoose.Schema(
    {
        kind: {
            type: String,
            enum: ['CREDIT_CARD', 'BANK_ACCOUNT'],
            required: true
        },

        refModel: {
            type: String,
            enum: ['CreditCard', 'BankAccount'],
            required: true
        },

        instrumentId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'paymentSource.refModel'
        }
    },
    { _id: false }
);


const UserRejectedDataSchema = new mongoose.Schema(
    {
        note: {
            type: String
        }
    },
    { _id: false }
);

const TransactionsToReviewSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        messageId: {
            type: String,
            required: true,
            unique: true
        },
        threadId: {
            type: String
        },

        status: {
            type: String,
            enum: ['READY_TO_REVIEW', 'APPROVED', 'AUTO_APPROVED', 'REJECTED'],
            default: 'READY_TO_REVIEW',
            required: true
        },

        date: {
            type: Date,
            required: true
        },

        cycle: {
            type: String,
            required: true,
            match: /^(0[1-9]|1[0-2])-\d{4}$/
        },

        amount: {
            type: Number,
            required: true
        },

        currency: {
            type: String,
            default: 'INR'
        },

        type: {
            type: String,
            enum: ['DEBIT', 'CREDIT'],
            required: true
        },

        merchantRaw: {
            type: String,
            required: true
        },

        referenceId: String,
        isCreditCardRepayment: {
            type: Boolean,
            default: false
        },

        merchantNormalized: {
            type: String,
            required: true,
            immutable: true
        },

        source: {
            type: String,
            enum: ['EMAIL', 'MANUAL', 'IMPORTED'],
            default: 'EMAIL',
            required: true
        },

        name: String,

        category: FieldValueSchema,
        subCategory: FieldValueSchema,
        /**
         * How the payment was made
         */
        paymentMode: {
            type: String,
            enum: ['UPI', 'CARD_PAYMENT', 'ATM_WITHDRAWAL', 'NET_BANKING', 'ONLINE_TRANSACTION'],
            required: true
        },

        paymentSource: {
            type: PaymentInstrumentSchema,
            required: true
        },

        notes: String,

        approvalActor: {
            type: String,
            enum: ['AI', 'MANUAL'],
            default: null
        },

        approvedAt: {
            type: Date,
            default: null
        },

        rejectedAt: {
            type: Date,
            default: null
        },

        transactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction',
            default: null,
            index: true
        },

        /**
         * Attachments uploaded during review. Belongs to the review itself —
         * intentionally NOT nested inside userApprovedData, since it must
         * survive independent of approve/reject transitions until Phase 2
         * (approval) moves them onto the promoted Transaction.
         */
        attachments: {
            type: [AttachmentSchema],
            default: []
        },

        /**
         * Final approved data (source of truth after review)
         */
        userApprovedData: {
            name: String,
            category: FieldValueSchema,
            subCategory: FieldValueSchema,
            paymentSource: PaymentInstrumentSchema,
            isCreditCardRepayment: {
                type: Boolean,
                default: false
            },
            isPrivate: {
                type: Boolean,
                default: false
            },
            notes: String
        },

        /**
         * Final rejected data (blacklist supervision)
         */
        userRejectedData: {
            type: UserRejectedDataSchema
        },

        /**
         * LLM metadata (NO senderEmail persisted)
         */
        LLMMeta: {
            confidence: {
                overall: { type: Number, min: 0, max: 1 },
                paymentSource: { type: Number, min: 0, max: 1 }
            },

            instrumentSignals: {
                upiId: String,
                cardLast4: String,
                cardType: {
                    type: String,
                    enum: ['CREDIT', 'DEBIT', null],
                    default: null
                },
                bank: String,
                bankAccountLast4: String
            },

            categorySubCategorySignals: {
                isGuessed: {
                    type: Boolean,
                    default: false
                },
                categoryId: String,
                subCategoryId: String
            },

            modelMeta: {
                model: String,
                promptVersion: String,
                extractedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        }
    },
    {
        timestamps: true,
        collection: 'transactionsToReview'
    }
);

/**
 * Domain invariants enforcement
 */
TransactionsToReviewSchema.pre('validate', function () {
    const {
        status,
        userApprovedData,
        userRejectedData
    } = this;

    if (status === 'APPROVED') {
        if (!userApprovedData || userRejectedData) {
            throw new Error(
                'APPROVED transactions must have userApprovedData and no userRejectedData'
            );
        }
        if (!this.approvedAt) {
            throw new Error('APPROVED transactions must have approvedAt');
        }
    }

    if (status === 'AUTO_APPROVED') {
        if (userRejectedData) {
            throw new Error(
                'AUTO_APPROVED transactions must not have userRejectedData'
            );
        }
        if (!this.approvedAt) {
            throw new Error(
                'AUTO_APPROVED transactions must have approvedAt'
            );
        }
    }

    if (status === 'REJECTED') {
        if (!userRejectedData || userApprovedData) {
            throw new Error(
                'REJECTED transactions must have userRejectedData and no userApprovedData'
            );
        }
        if (!this.rejectedAt) {
            throw new Error('REJECTED transactions must have rejectedAt');
        }
    }
});

module.exports = mongoose.model(
    'TransactionsToReview',
    TransactionsToReviewSchema
);
