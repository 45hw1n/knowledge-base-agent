const mongoose = require('mongoose');

const DebitCardSubSchema = new mongoose.Schema(
    {
        name: { type: String, default: 'Debit Card' },
        last4: { type: String, required: true },
        expiryMonth: { type: Number, min: 1, max: 12 },
        expiryYear: { type: Number },
        network: { type: String, enum: ['VISA', 'MASTERCARD', 'RUPAY', 'AMEX'], default: null }
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
const BankAccountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    bank: {
        type: String, // e.g., 'HDFC Bank', 'ICICI Bank'
        required: true
    },
    last4: {
        type: String,
        required: true
    },
    accountType: {
        type: String,
        enum: ['SAVINGS', 'CURRENT', 'SALARY', 'JOINT'],
        required: true
    },
    /**
     * UPI IDs linked to this bank account (e.g., 'user@hdfcbank')
     */
    upiIds: [{ type: String }],
    /**
     * Debit cards issued against this bank account
     */
    debitCards: [DebitCardSubSchema],
    openingBalance: {
        type: Number,
        default: 0
    },
    isPrimary: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'bankAccounts',
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
});

// Ensure only ONE active primary account per user natively in DB.
BankAccountSchema.index(
    { userId: 1, isPrimary: 1 },
    { unique: true, partialFilterExpression: { isPrimary: true, isActive: true } }
);

module.exports = mongoose.model('BankAccount', BankAccountSchema);
