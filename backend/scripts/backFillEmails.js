require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');

const AppStatus = require('../src/models/AppStatus');
const User = require('../src/models/User');
const syncEmailsService = require('../src/services/syncEmailsService');
const { updateAppStatusInternal } = require('../src/controllers/updateAppStatusController');

const EMAIL = 'ashwin.sundar.04@gmail.com';
const SINCE_DATE = '2026-03-01';

async function run() {
    if (!EMAIL || !SINCE_DATE) {
        throw new Error('Please provide EMAIL and SINCE_DATE');
    }
    try {
        // 1. Connect DB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ DB connected');




        // 2. Find user
        const user = await User.findOne({ email: EMAIL });

        if (!user) {
            throw new Error('User not found');
        }

        console.log(`👤 User found: ${user.email}`);

        // 3. Get AppStatus
        const appStatus = await AppStatus.findOne({ userId: user._id });

        if (!appStatus) {
            throw new Error('AppStatus not initialized');
        }

        // 4. Optional: bypass onboarding
        // appStatus.onboarded = true;
        // await appStatus.save();

        // 5. Acquire lock (same as mutation)
        const lockTimeout = new Date(Date.now() - 5 * 60 * 1000);

        await updateAppStatusInternal(
            user._id,
            {
                $set: { emailSyncStatus: 'IDLE' },
                $unset: { syncStartedAt: '' }
            },
            {
                emailSyncStatus: 'SYNC_IN_PROGRESS',
                syncStartedAt: { $lt: lockTimeout }
            }
        );

        const lock = await updateAppStatusInternal(
            user._id,
            {
                $set: {
                    emailSyncStatus: 'SYNC_IN_PROGRESS',
                    syncStartedAt: new Date()
                }
            },
            { emailSyncStatus: 'IDLE' }
        );

        if (!lock) {
            throw new Error('Another sync already in progress');
        }

        try {
            // 7. Parse date
            const sinceDateObj = new Date(SINCE_DATE);

            if (isNaN(sinceDateObj.getTime())) {
                throw new Error('Invalid date format');
            }

            console.log(`📅 Backfilling from: ${sinceDateObj.toISOString()}`);

            // 8. Run backfill
            const result = await syncEmailsService.syncEmailsByLookback(
                user._id,
                sinceDateObj
            );

            console.log('🎉 DONE');
            console.log(`Processed: ${result.processedCount}`);
        } finally {
            // 9. Release lock
            await updateAppStatusInternal(user._id, {
                $set: { emailSyncStatus: 'IDLE' },
                $unset: { syncStartedAt: '' }
            });

            console.log('🔓 Lock released');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

run();