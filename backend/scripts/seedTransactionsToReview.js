/**
 * Seed mock TransactionsToReview documents for manual flow testing.
 *
 * Usage:
 *   cd backend
 *   SEED_USER_ID=<userObjectId> node scripts/seedTransactionsToReview.js --dry
 *   SEED_USER_ID=<userObjectId> node scripts/seedTransactionsToReview.js
 *   node scripts/seedTransactionsToReview.js --userId=<userObjectId> --only=001,004
 *   node scripts/seedTransactionsToReview.js --cleanup   # also removes promoted mock transactions
 *
 * Requires MONGO_URI in .env.local and at least one BankAccount + CreditCard for the user.
 */
process.chdir(require('path').resolve(__dirname, '..'));

require('dotenv').config({ path: '.env.local' });

if (!process.env.MONGO_URI) {
    console.error('[seedTransactionsToReview] FATAL: MONGO_URI is not set in .env.local');
    process.exit(1);
}

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const TransactionsToReview = require('../src/models/TransactionsToReview');
const Transaction = require('../src/models/Transaction');
const BankAccount = require('../src/models/BankAccount');
const CreditCard = require('../src/models/CreditCard');
const User = require('../src/models/User');

const isDry = process.argv.includes('--dry');
const isCleanup = process.argv.includes('--cleanup');

const userIdArg = process.argv.find((a) => a.startsWith('--userId='));
const onlyArg = process.argv.find((a) => a.startsWith('--only='));

const SEED_USER_ID = userIdArg?.split('=')[1] || process.env.SEED_USER_ID;
const ONLY_SUFFIXES = onlyArg
    ? onlyArg
          .split('=')[1]
          .split(',')
          .map((s) => s.trim().padStart(3, '0'))
    : null;

const MESSAGE_ID_PREFIX = 'seed-mock-review-';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function buildFixtures({ userId, bankAccountId, creditCardId }) {
    const bankSource = {
        kind: 'BANK_ACCOUNT',
        refModel: 'BankAccount',
        instrumentId: bankAccountId
    };
    const ccSource = {
        kind: 'CREDIT_CARD',
        refModel: 'CreditCard',
        instrumentId: creditCardId
    };

    function base(overrides) {
        return {
            userId,
            currency: 'INR',
            source: 'EMAIL',
            date: new Date('2026-05-20T10:30:00.000Z'),
            cycle: '05-2026',
            merchantRaw: 'MOCK MERCHANT RAW',
            merchantNormalized: 'Mock Merchant',
            paymentSource: bankSource,
            paymentMode: 'UPI',
            LLMMeta: {
                confidence: { overall: 0.92, paymentSource: 0.88 },
                instrumentSignals: { upiId: 'mock@upi', bank: 'HDFC' },
                categorySubCategorySignals: { isGuessed: false },
                modelMeta: {
                    model: 'mock-seed',
                    promptVersion: '1',
                    extractedAt: new Date()
                }
            },
            ...overrides
        };
    }

    const all = [
        {
            suffix: '001',
            doc: base({
                messageId: `${MESSAGE_ID_PREFIX}001`,
                status: 'READY_TO_REVIEW',
                amount: 450,
                type: 'DEBIT',
                name: 'Swiggy order',
                merchantRaw: 'SWIGGY',
                merchantNormalized: 'Swiggy',
                category: { id: 'DINING', value: 'DINING', label: 'Dining' },
                subCategory: {
                    id: 'FOOD_DELIVERY',
                    value: 'FOOD_DELIVERY',
                    label: 'Food delivery'
                },
                notes: 'Mock: approve with category',
                isCreditCardRepayment: false
            })
        },
        {
            suffix: '002',
            doc: base({
                messageId: `${MESSAGE_ID_PREFIX}002`,
                status: 'READY_TO_REVIEW',
                amount: 12500,
                type: 'DEBIT',
                name: 'HDFC credit card payment',
                merchantRaw: 'HDFC CREDIT CARD PAYMENT',
                merchantNormalized: 'HDFC Credit Card',
                paymentMode: 'NET_BANKING',
                category: { id: 'DEBTS', value: 'DEBTS', label: 'Debts and Repayments' },
                subCategory: {
                    id: 'REPAYMENT_RECEIVED',
                    value: 'REPAYMENT_RECEIVED',
                    label: 'Repayment received'
                },
                isCreditCardRepayment: true,
                notes: 'Mock: mark as CC repayment on approve'
            })
        },
        {
            suffix: '003',
            doc: base({
                messageId: `${MESSAGE_ID_PREFIX}003`,
                status: 'READY_TO_REVIEW',
                amount: 199,
                type: 'DEBIT',
                name: 'Unknown debit',
                merchantRaw: 'UNKNOWN DEBIT',
                merchantNormalized: 'Unknown',
                notes: 'Mock: approve should return VALIDATION_ERROR',
                isCreditCardRepayment: false
            })
        },
        {
            suffix: '004',
            doc: base({
                messageId: `${MESSAGE_ID_PREFIX}004`,
                status: 'READY_TO_REVIEW',
                amount: 999,
                type: 'DEBIT',
                name: 'Stale approved data',
                merchantRaw: 'STALE DATA TEST',
                merchantNormalized: 'Stale Data',
                category: { id: 'SHOPPING', value: 'SHOPPING', label: 'Shopping' },
                subCategory: {
                    id: 'ELECTRONICS',
                    value: 'ELECTRONICS',
                    label: 'Electronics'
                },
                userApprovedData: {
                    name: 'Stale snapshot',
                    isCreditCardRepayment: false,
                    notes: 'Should not exist on READY_TO_REVIEW'
                },
                notes: 'Mock: reject should fail until userApprovedData is cleared on reject'
            })
        },
        {
            suffix: '005',
            doc: base({
                messageId: `${MESSAGE_ID_PREFIX}005`,
                status: 'READY_TO_REVIEW',
                amount: 2500,
                type: 'DEBIT',
                name: 'Amazon purchase',
                merchantRaw: 'AMAZON PAY',
                merchantNormalized: 'Amazon',
                paymentSource: ccSource,
                paymentMode: 'CARD_PAYMENT',
                category: { id: 'SHOPPING', value: 'SHOPPING', label: 'Shopping' },
                subCategory: {
                    id: 'ELECTRONICS',
                    value: 'ELECTRONICS',
                    label: 'Electronics'
                },
                notes: 'Mock: edit amount/date then save & approve'
            })
        },
        {
            suffix: '006',
            doc: base({
                messageId: `${MESSAGE_ID_PREFIX}006`,
                status: 'READY_TO_REVIEW',
                amount: 75,
                type: 'CREDIT',
                name: 'Refund',
                merchantRaw: 'REFUND CREDIT',
                merchantNormalized: 'Refund',
                category: { id: 'REFUND', value: 'REFUND', label: 'Refund' },
                subCategory: { id: 'CASHBACK', value: 'CASHBACK', label: 'Cashback' },
                notes: 'Mock: reject with notes'
            })
        },
        {
            suffix: '007',
            doc: base({
                messageId: `${MESSAGE_ID_PREFIX}007`,
                status: 'REJECTED',
                amount: 50,
                type: 'DEBIT',
                name: 'Already rejected',
                merchantNormalized: 'Rejected Mock',
                rejectedAt: new Date('2026-05-18T12:00:00.000Z'),
                userRejectedData: { note: 'Seeded rejection' },
                category: { id: 'DINING', value: 'DINING', label: 'Dining' },
                subCategory: { id: 'CAFE', value: 'CAFE', label: 'Cafe' }
            })
        },
        {
            suffix: '008',
            doc: base({
                messageId: `${MESSAGE_ID_PREFIX}008`,
                status: 'AUTO_APPROVED',
                amount: 299,
                type: 'DEBIT',
                name: 'Netflix',
                merchantRaw: 'NETFLIX',
                merchantNormalized: 'Netflix',
                approvalActor: 'AI',
                approvedAt: new Date('2026-05-19T09:00:00.000Z'),
                category: {
                    id: 'SUBSCRIPTION',
                    value: 'SUBSCRIPTION',
                    label: 'Subscription'
                },
                subCategory: {
                    id: 'VIDEO_STREAMING',
                    value: 'VIDEO_STREAMING',
                    label: 'Video streaming'
                }
            })
        }
    ];

    if (!ONLY_SUFFIXES) return all;
    return all.filter((f) => ONLY_SUFFIXES.includes(f.suffix));
}

// ---------------------------------------------------------------------------
// Resolve user + instruments
// ---------------------------------------------------------------------------

async function resolveSeedContext() {
    let userId = SEED_USER_ID;

    if (!userId) {
        const user = await User.findOne({}).sort({ createdAt: 1 }).lean();
        if (!user) {
            throw new Error(
                'No users in database. Set SEED_USER_ID or pass --userId=<objectId>'
            );
        }
        userId = user._id.toString();
        console.log(
            `[seedTransactionsToReview] No SEED_USER_ID — using first user: ${userId}` +
                (user.email ? ` (${user.email})` : '')
        );
    } else {
        const user = await User.findById(userId).lean();
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }
        console.log(
            `[seedTransactionsToReview] Using user: ${userId}` +
                (user.email ? ` (${user.email})` : '')
        );
    }

    const bankAccount = await BankAccount.findOne({ userId }).lean();
    if (!bankAccount) {
        throw new Error(
            `No bank account for user ${userId}. Create one before seeding.`
        );
    }

    const creditCard = await CreditCard.findOne({ userId }).lean();
    if (!creditCard) {
        throw new Error(
            `No credit card for user ${userId}. Create one before seeding.`
        );
    }

    console.log(
        `[seedTransactionsToReview] BankAccount: ${bankAccount._id} (${bankAccount.name})`
    );
    console.log(
        `[seedTransactionsToReview] CreditCard: ${creditCard._id} (${creditCard.name})`
    );

    return {
        userId: new mongoose.Types.ObjectId(userId),
        bankAccountId: bankAccount._id,
        creditCardId: creditCard._id
    };
}

// ---------------------------------------------------------------------------
// Seed / cleanup
// ---------------------------------------------------------------------------

const SEED_MESSAGE_ID_FILTER = { messageId: new RegExp(`^${MESSAGE_ID_PREFIX}`) };

async function cleanup() {
    if (isDry) {
        const reviewCount = await TransactionsToReview.countDocuments(SEED_MESSAGE_ID_FILTER);
        const txnCount = await Transaction.countDocuments(SEED_MESSAGE_ID_FILTER);
        console.log(
            `[seedTransactionsToReview] [DRY RUN] Would delete ${reviewCount} review document(s) and ${txnCount} transaction document(s).`
        );
        return;
    }

    const reviewResult = await TransactionsToReview.deleteMany(SEED_MESSAGE_ID_FILTER);
    console.log(
        `[seedTransactionsToReview] Deleted ${reviewResult.deletedCount} review document(s) from transactionsToReview.`
    );

    const txnResult = await Transaction.deleteMany(SEED_MESSAGE_ID_FILTER);
    console.log(
        `[seedTransactionsToReview] Deleted ${txnResult.deletedCount} transaction document(s) from transactions.`
    );
}

function prepareDocForSave(doc) {
    const payload = { ...doc };

    // Avoid Mongoose materializing empty userApprovedData on terminal statuses
    if (payload.status !== 'APPROVED') {
        delete payload.userApprovedData;
    }
    if (payload.status !== 'REJECTED') {
        delete payload.userRejectedData;
    }

    return payload;
}

async function upsertFixture({ suffix, doc }) {
    const payload = prepareDocForSave(doc);
    const existing = await TransactionsToReview.findOne({ messageId: payload.messageId });

    if (isDry) {
        console.log(
            `[seedTransactionsToReview] [DRY RUN] Would upsert ${payload.messageId} (${payload.status})`
        );
        return { messageId: payload.messageId, action: 'dry-run' };
    }

    // Preserve intentional userApprovedData on READY docs (e.g. fixture 004)
    if (doc.userApprovedData && doc.status === 'READY_TO_REVIEW') {
        payload.userApprovedData = doc.userApprovedData;
    }

    const update = { $set: payload };
    const unset = {};

    if (payload.status !== 'APPROVED' && !payload.userApprovedData) {
        unset.userApprovedData = '';
    }
    if (payload.status !== 'REJECTED') {
        unset.userRejectedData = '';
    }
    if (Object.keys(unset).length > 0) {
        update.$unset = unset;
    }

    const result = await TransactionsToReview.findOneAndUpdate(
        { messageId: payload.messageId },
        update,
        { upsert: true, new: true, runValidators: true }
    );

    const action = existing ? 'updated' : 'created';
    console.log(
        `[seedTransactionsToReview] ${action === 'created' ? 'Created' : 'Updated'} ${payload.messageId} → _id ${result._id}`
    );
    return {
        messageId: payload.messageId,
        action,
        id: result._id.toString()
    };
}

async function runSeed() {
    const ctx = await resolveSeedContext();
    const fixtures = buildFixtures(ctx);

    console.log(
        `[seedTransactionsToReview] Seeding ${fixtures.length} fixture(s)...`
    );

    const results = [];
    for (const fixture of fixtures) {
        results.push(await upsertFixture(fixture));
    }

    console.log('\n[seedTransactionsToReview] Summary:');
    for (const r of results) {
        console.log(`  - ${r.messageId}: ${r.action}${r.id ? ` (${r.id})` : ''}`);
    }

    console.log('\n[seedTransactionsToReview] Carousel shows READY_TO_REVIEW only (001–006).');
    console.log('[seedTransactionsToReview] Cleanup: node scripts/seedTransactionsToReview.js --cleanup');
}

async function main() {
    try {
        console.log('[seedTransactionsToReview] Connecting to MongoDB...');
        await connectDB();

        if (isCleanup) {
            await cleanup();
            return;
        }

        await runSeed();
    } catch (err) {
        console.error('[seedTransactionsToReview] Failed:', err.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('[seedTransactionsToReview] Disconnected.');
    }
}

module.exports = { buildFixtures, runSeed, cleanup, MESSAGE_ID_PREFIX };

if (require.main === module) {
    main();
}
