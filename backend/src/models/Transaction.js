const mongoose = require('mongoose');
const AttachmentSchema = require('./schemas/AttachmentSchema');

/**
 * Generic selectable field
 * (category, subCategory, paymentMode, etc.)
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

const TransactionSchema = new mongoose.Schema(
  {
    /**
     * Ownership (single-user today, multi-user ready)
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    /**
     * Core financial fields
     */
    amount: {
      type: Number,
      required: true
    },

    currency: {
      type: String,
      default: 'INR'
    },

    /**
     * CREDIT | DEBIT
     * (must match TransactionsToReview)
     */
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true
    },

    /**
     * When the transaction actually happened
     */
    date: {
      type: Date,
      required: true,
      index: true
    },

    /**
     * User-facing name (editable, required)
     */
    name: {
      type: String,
      required: true,
      index: true
    },

    /**
     * Raw / system merchant signals
     */
    merchant: {
      type: String
    },

    merchantNormalized: {
      type: String,
      required: true,
      immutable: true
    },

    /**
     * User-facing notes
     */
    notes: {
      type: String
    },

    /**
     * Classification
     */
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

    /**
     * Payment instrument used (CreditCard or BankAccount)
     */
    paymentSource: {
      type: PaymentInstrumentSchema,
      required: true
    },

    /**
     * Credit card repayment marker
     */
    isCreditCardRepayment: {
      type: Boolean,
      default: false
    },

    isPrivate: {
      type: Boolean,
      default: false
    },

    cycle: {
      type: String,
      required: true,
      match: /^(0[1-9]|1[0-2])-\d{4}$/
    },

    /**
     * Source of transaction
     */
    source: {
      type: String,
      enum: ['EMAIL', 'MANUAL', 'IMPORTED'],
      default: 'EMAIL',
      immutable: true
    },

    /**
     * Unique display identifier for user review
     */
    displayId: {
      type: String,
      required: true,
      index: true
    },

    /**
     * EMI linkage fields
     */
    emiPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmiPlan',
      index: true
    },

    isEmiInstallment: {
      type: Boolean,
      default: false,
      index: true
    },

    installmentNumber: {
      type: Number
    },

    installmentTotal: {
      type: Number
    },

    principalComponent: {
      type: Number
    },

    interestComponent: {
      type: Number
    },

    /**
     * Traceability to email
     */
    messageId: {
      type: String,
      unique: true,
      sparse: true
    },

    /**
     * Traceability to review record
     */
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransactionsToReview',
      default: null,
      index: true
    },

    attachments: {
      type: [AttachmentSchema],
      default: []
    },

    /**
     * Approval tracking
     */
    approvalActor: {
      type: String,
      enum: ['AI', 'MANUAL'],
      default: 'MANUAL'
    },

    /**
     * Google Sheets sync tracking
     */
    sheetSyncStatus: {
      type: String,
      enum: ['PENDING', 'SYNCED', 'FAILED'],
      default: null
    },

    sheetSyncedAt: {
      type: Date,
      default: null
    },

    sheetSyncError: {
      type: String,
      default: null
    },
    /**
     * Soft delete
     */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'transactions'
  }
);

/**
 * Domain invariants enforcement
 */
TransactionSchema.pre('validate', function () {
  const {
    type,
    isCreditCardRepayment,
    category,
    subCategory,
    approvalActor
  } = this;

  if (
    type === 'DEBIT' &&
    !isCreditCardRepayment &&
    approvalActor !== 'AI' &&
    (!category || !subCategory)
  ) {
    throw new Error('DEBIT transactions must have category and subCategory');
  }
});

/**
 * Indexes for common queries
 */
TransactionSchema.index({ userId: 1, displayId: 1 }, { unique: true });
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, emiPlanId: 1 });
TransactionSchema.index({ isCreditCardRepayment: 1 });
TransactionSchema.index({ userId: 1, sheetSyncStatus: 1 });
TransactionSchema.index({ userId: 1, isDeleted: 1, date: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
