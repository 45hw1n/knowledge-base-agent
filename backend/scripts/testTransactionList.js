#!/usr/bin/env node
/**
 * Directly calls listTransactions() from transactionListService and logs the result.
 *
 * Usage:
 *   node scripts/testTransactionList.js
 *
 * Requires:
 *   - backend/.env.local with MONGO_URI set
 *   - USER_ID env var (MongoDB ObjectId of the user to query as)
 *
 *   USER_ID=<your_user_id> node scripts/testTransactionList.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const mongoose = require('mongoose');
const { listTransactions } = require('../src/services/transactionListService');

// ─── Modify this payload to test different inputs ───────────────────────────
const payload = {
    listInfo: {
        page: 1,
        pageSize: 10,
        sort: [{ attribute: 'date', order: 'DESC' }],
        conditions: {
            operator: 'AND',
            operands: [
                { attribute: 'type', operator: 'is', value: 'DEBIT' }
            ]
        }
    }
};
// ────────────────────────────────────────────────────────────────────────────

async function main() {
    const userId = process.env.USER_ID;
    if (!userId) {
        console.error('USER_ID env var is required. Run as: USER_ID=<your_user_id> node scripts/testTransactionList.js');
        process.exit(1);
    }

    console.log(`Connecting to MongoDB at ${process.env.MONGO_URI}...`);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.\n');

    const result = await listTransactions(payload, { userId });

    console.log('--- data ---');
    console.log(JSON.stringify(result.data, null, 2));

    console.log('\n--- listInfo ---');
    console.log(JSON.stringify(result.listInfo, null, 2));

    console.log('\n--- pagination ---');
    console.log(JSON.stringify(result.pagination, null, 2));

    console.log('\n--- meta ---');
    console.log(JSON.stringify(result.meta, null, 2));
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => mongoose.disconnect());
