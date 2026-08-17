const UserPreferences = require('../models/UserPreferences');

async function getUserPreferences(userId) {
    return await UserPreferences.findOne({ userId });
}

/**
 * Update or create user preferences (UPSERT)
 * @param {string} userId - ID of the user
 * @param {Object} input - Preferences fields to update
 * @returns {Promise<Object>} Updated preferences document
 */
async function updateUserPreferences(userId, input) {
    try {
        const allowedFields = ["salaryCycleDay", "monthlyBudget", "emailSyncStartDate", "autoProcess"];

        const filteredInput = Object.fromEntries(
            Object.entries(input).filter(([key]) => allowedFields.includes(key))
        );

        if (!Object.keys(filteredInput).length) {
            throw new Error("No valid fields provided");
        }

        return await UserPreferences.findOneAndUpdate(
            { userId },
            { $set: filteredInput },
            { new: true, upsert: true, runValidators: true }
        );
    } catch (error) {
        console.error('Error updating preferences:', error);
        throw error;
    }
}

module.exports = {
    getUserPreferences,
    updateUserPreferences
};
