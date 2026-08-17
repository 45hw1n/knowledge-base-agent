const mongoose = require('mongoose');

const AppStatusSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    emailLastSyncedAt: {
        type: Date,
        default: null
    },
    onboarded: {
        type: Boolean,
        default: false
    },
    emailSyncStatus: {
        type: String,
        enum: ['IDLE', 'SYNC_IN_PROGRESS'],
        default: 'IDLE',
        index: true
    },
    lastLoggedInAt: {
        type: Date,
        default: null,
        index: true
    },
    /**
     * Tracks per-messageId failure counts during history sync.
     * Key: Gmail messageId  Value: number of consecutive failures
     * Used to detect poison emails (those that always fail) so they
     * don't block historyId advancement indefinitely.
     */
    syncFailures: {
        type: Map,
        of: Number,
        default: {}
    },
    /**
     * Timestamp when the current SYNC_IN_PROGRESS lock was acquired.
     * Used to expire stale locks (e.g., after a server crash mid-sync).
     */
    syncStartedAt: {
        type: Date,
        default: null
    },
    debitProcessingInProgress: {
        type: Boolean,
        default: false
    },
    lastDebitAIProcessStartedAt: {
        type: Date,
        default: null
    },
    lastDebitAIProcessCompletedAt: {
        type: Date,
        default: null
    },
    lastDebitAIProcessedCount: {
        type: Number,
        default: 0
    },
    showPrivateEntity: {
        type: Boolean,
        default: false
    },
    // Placeholder for future field: paymentPending: Boolean

}, {
    collection: 'appStatus',
    timestamps: true
});

/**
 * 🚨 DO NOT USE DIRECTLY
 * All updates must go through updateAppStatus() or updateAppStatusInternal()
 */
const throwDirectUpdateError = function(next) {
    if (!this.options || !this.options.isInternalUpdater) {
        const err = new Error('🚨 STRICT INVARIANT: All AppStatus updates must go through updateAppStatus()');
        if (typeof next === 'function') return next(err);
        throw err;
    }
    if (typeof next === 'function') next();
};

AppStatusSchema.pre('updateOne', throwDirectUpdateError);
AppStatusSchema.pre('findOneAndUpdate', throwDirectUpdateError);
AppStatusSchema.pre('updateMany', throwDirectUpdateError);

AppStatusSchema.pre('save', function(next) {
    if (!this.$__.saveOptions?.isInternalUpdater) {
        const err = new Error('🚨 STRICT INVARIANT: Use updateAppStatus() instead of direct save()');
        if (typeof next === 'function') return next(err);
        throw err;
    }
    if (typeof next === 'function') next();
});

module.exports = mongoose.model('AppStatus', AppStatusSchema);
