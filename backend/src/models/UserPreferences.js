const mongoose = require('mongoose');

const UserPreferencesSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    emailSyncStartDate: {
        type: Date,
        optional: true
    },
    isBetaUser: {
        type: Boolean,
        default: false
    },
    autoProcess: {
        type: Boolean,
        default: false
    }
}, {
    collection: 'userPreferences',
    timestamps: true
});

module.exports = mongoose.model('UserPreferences', UserPreferencesSchema);
