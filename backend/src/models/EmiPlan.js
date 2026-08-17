const mongoose = require('mongoose');

const EmiPlanSchema = new mongoose.Schema(
    {
        /**
         * Ownership
         */
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        /**
         * Plan details
         */
        name: {
            type: String,
            required: true
        },

        merchant: {
            type: String
        },

        merchantNormalized: {
            type: String,
            required: true
        },

        /**
         * Financial components
         */
        totalPrincipal: {
            type: Number,
            required: true
        },

        tenure: {
            type: Number,
            required: true
        },

        annualInterestRate: {
            type: Number,
            default: 0
        },

        processingFee: {
            type: Number,
            default: 0
        },

        monthlyEmiAmount: {
            type: Number,
            required: true
        },

        totalInterest: {
            type: Number,
            required: true
        },

        totalPayable: {
            type: Number,
            required: true
        },

        /**
         * Lifecycle
         */
        startDate: {
            type: Date,
            required: true
        },

        installmentsPaid: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
            default: 'ACTIVE'
        },
        endDate: {
            type: Date,
            required: true,
            index: true
        },
    },
    {
        timestamps: true,
        collection: 'emiPlans'
    }
);

/**
 * Indexes
 */
EmiPlanSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('EmiPlan', EmiPlanSchema);
