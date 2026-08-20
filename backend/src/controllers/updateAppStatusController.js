const AppStatus = require('../models/AppStatus');

async function updateAppStatus(userId, updates) {
    console.log('[AppStatus] Received update request:', {
      userId,
      updates
    });
    const allowedProperties = ['emailLastSyncedAt', 'emailSyncStatus', 'lastLoggedInAt', 'showPrivateEntity'];

    try {
        if (!userId) {
            throw new Error('userId is required for updating app status');
        }

        if (!updates || typeof updates !== 'object') {
            throw new Error('updates object is required');
        }

        const filteredUpdates = {};

        Object.keys(updates).forEach(key => {
            if (!allowedProperties.includes(key)) return;

            if (key === 'emailLastSyncedAt' || key === 'lastLoggedInAt') {
                const date = new Date(updates[key]);
                if (isNaN(date)) {
                    throw new Error(`Invalid date for ${key}`);
                }
                filteredUpdates[key] = date;
            } else if (key === 'showPrivateEntity' && typeof updates[key] !== 'boolean') {
                throw new Error('Invalid value for showPrivateEntity: expected boolean');
            } else {
                filteredUpdates[key] = updates[key];
            }
        });

        if (Object.keys(filteredUpdates).length === 0) {
            throw new Error(
                'No valid update fields provided. Allowed fields: ' +
                allowedProperties.join(', ')
            );
        }

        console.log(`[AppStatus] Updating for user ${userId}:`, filteredUpdates);

        const updatedStatus = await AppStatus.findOneAndUpdate(
            { userId },
            {
                $set: filteredUpdates,
                $setOnInsert: { userId }
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
                setDefaultsOnInsert: true,
                isInternalUpdater: true
            }
        );

        console.log('[AppStatus] Updated document:', updatedStatus);
        console.log(`✅ App status updated for user: ${userId}`);
        return updatedStatus;
    } catch (error) {
        console.error(`❌ Error updating app status for user ${userId}:`, error.message);
        throw error;
    }
}

/**
 * 🚨 INTERNAL USE ONLY
 * Executed for $inc, $unset, and conditional updates (locks).
 */
async function updateAppStatusInternal(userId, operation, customFilter = {}, options = {}) {
    if (!userId) {
        throw new Error('userId is required for internal app status update');
    }

    if (customFilter.userId && String(customFilter.userId) !== String(userId)) {
        throw new Error('customFilter.userId must match the provided userId');
    }

    const finalFilter = { userId, ...customFilter };

    const safeOperation = { ...operation };
    if (!safeOperation.$setOnInsert) {
        safeOperation.$setOnInsert = {};
    }
    safeOperation.$setOnInsert.userId = userId;

    const mergedOptions = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        isInternalUpdater: true,
        ...options
    };

    try {
        return await AppStatus.findOneAndUpdate(finalFilter, safeOperation, mergedOptions);
    } catch (error) {
        // Prevent Race Conditions on conditional upsert locking
        // If it fails due to existing document failing the customFilter, retry without upsert safely.
        if (error.code === 11000) {
            console.warn(`[AppStatus] E11000 race condition handled for user ${userId}. Retrying without upsert.`);
            const fallbackOptions = { ...mergedOptions, upsert: false };
            return await AppStatus.findOneAndUpdate(finalFilter, safeOperation, fallbackOptions);
        }
        
        console.error(`❌ Error in updateAppStatusInternal for user ${userId}:`, error.message);
        throw error;
    }
}

module.exports = { updateAppStatus, updateAppStatusInternal };