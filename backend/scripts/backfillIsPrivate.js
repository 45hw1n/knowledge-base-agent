const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Transaction = require('../src/models/Transaction');

const isDryRun = process.argv.includes('--dry');

async function run() {
    if (!process.env.MONGO_URI) {
        console.error('[backfillIsPrivate] MONGO_URI is not defined. Check your .env file.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('[backfillIsPrivate] Connected to DB');

    const filter = { isPrivate: { $exists: false } };
    const count = await Transaction.countDocuments(filter);

    if (isDryRun) {
        console.log(`[backfillIsPrivate] [DRY RUN] Would update ${count} transaction(s)`);
    } else {
        const result = await Transaction.updateMany(filter, { $set: { isPrivate: false } });
        console.log(`[backfillIsPrivate] Transactions updated: ${result.modifiedCount}`);
    }

    await mongoose.disconnect();
    console.log('[backfillIsPrivate] Disconnected.');
    process.exit(0);
}

(async () => {
    try {
        await run();
    } catch (err) {
        console.error('[backfillIsPrivate] Failed:', err.message);
        process.exit(1);
    }
})();
