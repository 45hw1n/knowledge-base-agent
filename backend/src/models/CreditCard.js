const mongoose = require('mongoose');

const CreditCardSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String, // e.g., 'HDFC Millennia'
        required: true
    },
    bank: {
        type: String,
        required: true
    },
    last4: {
        type: String,
        required: true
    },
    expiryMonth: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    expiryYear: {
        type: Number,
        required: true,
        min: 2024
    },
    network: {
        type: String,
        enum: ['VISA', 'MASTERCARD', 'RUPAY', 'AMEX'],
        default: null
    },
    billingCycleDay: {
        type: Number,
        required: true,
        min: 1,
        max: 31
    },
    dueDateDay: {
        type: Number,
        required: true,
        min: 1,
        max: 31
    },
    creditLimit: {
        type: Number,
        default: null
    },
    linkedBankAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankAccount',
        index: true // Optional repayment linkage
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'creditCards',
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

// Index for duplicate card prevention (same card last4 under same bank per user)
CreditCardSchema.index(
    { userId: 1, last4: 1, bank: 1, isActive: 1 },
    { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('CreditCard', CreditCardSchema);
