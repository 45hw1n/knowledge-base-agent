/**
 * testGoogleSheetService.js
 *
 * Test script to verify Google Sheets sync with mock transaction data.
 *
 * Usage:
 *   NODE_ENV=local node scripts/testGoogleSheetService.js <SHEET_ID>
 *
 * Example:
 *   NODE_ENV=local node scripts/testGoogleSheetService.js 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
 */

const config = require('../src/config');
const connectDB = require('../src/config/db');

async function main() {
    const sheetId = process.argv[2];

    if (!sheetId) {
        console.error('❌ Usage: NODE_ENV=local node scripts/testGoogleSheetService.js <SHEET_ID>');
        process.exit(1);
    }

    console.log(`📋 Sheet ID: ${sheetId}`);

    // 1. Connect to DB
    await connectDB();

    const User = require('../src/models/User');
    const UserPreferences = require('../src/models/UserPreferences');
    const mongoose = require('mongoose');

    // 2. Find the first user
    const user = await User.findOne({});
    if (!user) {
        console.error('❌ No user found in the database');
        process.exit(1);
    }
    console.log(`👤 Using user: ${user.displayName} (${user.email})`);

    // 3. Check granted scopes
    const scopes = user.grantedScopes || [];
    console.log('🔑 Granted scopes:', scopes);

    const hasSpreadsheets = user.isGoogleServiceEnabled('SPREADSHEETS');

    if (!hasSpreadsheets) {
        console.warn('⚠️  User does NOT have Sheets scopes. The test will show the FAILED path.');
    }

    // 4. Temporarily set the googleSheetId in preferences
    await UserPreferences.findOneAndUpdate(
        { userId: user._id },
        { $set: { googleSheetId: sheetId } },
        { upsert: true, new: true }
    );
    console.log('✅ Set googleSheetId in UserPreferences');

    // 5. Create mock transaction data
    const mockTransactions = [
        {
            _id: new mongoose.Types.ObjectId(),
            userId: user._id,
            amount: 1499.00,
            currency: 'INR',
            type: 'DEBIT',
            date: new Date('2026-04-07T14:30:00Z'),
            name: 'Swiggy Order',
            merchant: 'SWIGGY',
            merchantNormalized: 'Swiggy',
            category: { id: 'food', value: 'food', label: 'Food & Dining' },
            subCategory: { id: 'delivery', value: 'delivery', label: 'Food Delivery' },
            paymentMode: 'UPI',
            paymentInstrument: { kind: 'BANK_ACCOUNT', refModel: 'BankAccount', instrumentId: new mongoose.Types.ObjectId() },
            isCreditCardRepayment: false,
            isPrivate: false,
            displayId: 'TXN-20260407-001',
            sheetSyncStatus: 'PENDING',
        },
        {
            _id: new mongoose.Types.ObjectId(),
            userId: user._id,
            amount: 25000.00,
            currency: 'INR',
            type: 'DEBIT',
            date: new Date('2026-04-06T10:00:00Z'),
            name: 'HDFC Credit Card Payment',
            merchant: 'HDFC BANK',
            merchantNormalized: 'HDFC Bank',
            category: null,
            subCategory: null,
            paymentMode: 'NET_BANKING',
            paymentInstrument: { kind: 'BANK_ACCOUNT', refModel: 'BankAccount', instrumentId: new mongoose.Types.ObjectId() },
            isCreditCardRepayment: true,
            isPrivate: false,
            displayId: 'TXN-20260406-001',
            sheetSyncStatus: 'PENDING',
        },
        {
            _id: new mongoose.Types.ObjectId(),
            userId: user._id,
            amount: 799.00,
            currency: 'INR',
            type: 'DEBIT',
            date: new Date('2026-04-05T18:45:00Z'),
            name: 'Netflix Subscription',
            merchant: 'NETFLIX',
            merchantNormalized: 'Netflix',
            category: { id: 'entertainment', value: 'entertainment', label: 'Entertainment' },
            subCategory: { id: 'streaming', value: 'streaming', label: 'Streaming' },
            paymentMode: 'CARD_PAYMENT',
            paymentInstrument: { kind: 'CREDIT_CARD', refModel: 'CreditCard', instrumentId: new mongoose.Types.ObjectId() },
            isCreditCardRepayment: false,
            isPrivate: false,
            displayId: 'TXN-20260405-001',
            sheetSyncStatus: 'PENDING',
        },
    ];

    console.log(`\n📦 Mock transactions: ${mockTransactions.length}`);
    mockTransactions.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.displayId} | ${t.name} | ₹${t.amount} | ${t.type}`);
    });

    // 6. Test single append
    console.log('\n--- Testing single appendTransaction ---');
    const googleSheetService = require('../src/services/googleSheetService');

    const singleResult = await googleSheetService.appendTransaction(
        user._id.toString(),
        mockTransactions[0]
    );
    console.log('Result:', singleResult);

    // 7. Test batch append
    console.log('\n--- Testing batch appendTransactions ---');
    const batchResult = await googleSheetService.appendTransactions(
        user._id.toString(),
        mockTransactions.slice(1)  // remaining 2
    );
    console.log('Result:', batchResult);

    console.log('\n✅ Test complete! Check your Google Sheet.');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
