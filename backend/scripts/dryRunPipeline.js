const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mongoose = require('mongoose');

const DebitEmailToProcess = require('../src/models/DebitEmailToProcess');
const contextBuilder = require('../src/ai/features/processDebitEmails/context');
const promptBuilder = require('../src/ai/features/processDebitEmails/prompt');
const aiClient = require('../src/ai/client');
const postProcessor = require('../src/ai/features/processDebitEmails/postProcessor');
const TransactionsToReview = require('../src/models/TransactionsToReview');
const Transaction = require('../src/models/Transaction');
const UserPreferences = require('../src/models/UserPreferences');

const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 2;

async function run() {
    try {
        console.log(`\nConnecting to MongoDB at ${process.env.MONGO_URI}...`);
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`Connected to MongoDB.\n`);

        // Fetch emails. We grab processing ones if any, else detected.
        const emails = await DebitEmailToProcess.find({
            status: { $in: ['LLM_PROCESSED', 'DETECTED'] }
        }).sort({ createdAt: -1 }).limit(LIMIT).lean();

        if (emails.length === 0) {
            console.log('No emails found to process.');
            return;
        }

        console.log(`Found ${emails.length} emails. Starting dry run...\n`);

        const summary = [];
        const sharedDataCache = new Map();

        for (const email of emails) {
            console.log(`\n1. Processing email`);

            try {
                // Fetch User Preferences to simulate autoProcess and sheet
                const prefs = await mongoose.model('UserPreferences').findOne({ userId: email.accountUserId }).lean();
                const autoProcess = prefs?.autoProcess || false;
                const hasSheet = Boolean(prefs?.googleSheetId);

                const userId = email.accountUserId.toString();
                if (!sharedDataCache.has(userId)) {
                    sharedDataCache.set(userId, await contextBuilder.fetchSharedData(userId));
                }
                const sharedData = sharedDataCache.get(userId);

                const context = await contextBuilder.build(email._id.toString(), email.accountUserId, sharedData);
                const prompt = promptBuilder.generate(context);

                let aiResponse;
                try {
                    const aiResponseRaw = await aiClient.generate(prompt);
                    if (typeof aiResponseRaw === 'string') {
                        let cleanJson = aiResponseRaw.replace(/```json/g, '').replace(/```/g, '').trim();
                        aiResponse = JSON.parse(cleanJson);
                    } else {
                        aiResponse = aiResponseRaw;
                    }
                } catch (e) {
                    console.error("AI generation or parsing failed!");
                    throw e;
                }

                console.log(`2. Output from the AI`);
                console.log(JSON.stringify(aiResponse, null, 2));

                const referenceData = {
                    categories: context.categories.map(c => ({ _id: c.id, code: c.id, name: c.label })),
                    subCategories: context.subCategories.map(sc => ({ _id: sc.id, code: sc.id, name: sc.label, categoryId: sc.categoryId })),
                    paymentSources: context.paymentSources.map(pi => ({
                        _id: pi.id,
                        type: pi.type,
                        last4: pi.last4,
                        bank: pi.bank,
                        upiIds: pi.upiIds,
                        debitCardLast4s: pi.debitCardLast4s
                    }))
                };

                const processedTxn = await postProcessor.processAITransaction({
                    aiData: aiResponse,
                    userId: email.accountUserId,
                    messageId: email.messageId,
                    threadId: email.threadId,
                    referenceData
                });

                const reviewDoc = new TransactionsToReview(processedTxn);

                console.log(`3. transactionToReview`);
                console.log(JSON.stringify(reviewDoc.toObject(), null, 2));

                if (autoProcess) {
                    console.log(`=== AUTO PROCESS ENABLED ====`);

                    reviewDoc.status = 'AUTO_APPROVED';
                    reviewDoc.approvalActor = 'AI';

                    console.log(`5. updated transactionToReview`);
                    console.log(JSON.stringify(reviewDoc.toObject(), null, 2));

                    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
                    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10).replace(/-/g, "");
                    const simDisplayId = `TXN-${localISOTime}-001`;

                    const mockTxnData = {
                        userId: reviewDoc.userId,
                        amount: reviewDoc.amount,
                        currency: reviewDoc.currency || 'INR',
                        type: reviewDoc.type,
                        date: reviewDoc.date,
                        name: reviewDoc.name || reviewDoc.merchantNormalized,
                        merchant: reviewDoc.merchantRaw,
                        merchantNormalized: reviewDoc.merchantNormalized,
                        category: reviewDoc.category || null,
                        subCategory: reviewDoc.subCategory || null,
                        paymentMode: reviewDoc.paymentMode,
                        paymentSource: reviewDoc.paymentSource,
                        isCreditCardRepayment: reviewDoc.isCreditCardRepayment || false,
                        messageId: reviewDoc.messageId,
                        source: reviewDoc.source || 'EMAIL',
                        displayId: simDisplayId,
                        approvalActor: 'AI',
                        notes: reviewDoc.notes || null,
                        sheetSyncStatus: hasSheet ? 'PENDING' : null
                    };

                    const txnDoc = new Transaction(mockTxnData);

                    console.log(`6 . transaction`);
                    console.log(JSON.stringify(txnDoc.toObject(), null, 2));

                    if (hasSheet) {
                        console.log(`7. if sheetId preset`);
                        console.log(`updating sheet`);
                        console.log(`sheet update completed`);
                    }
                }

            } catch (err) {
                console.error(`\n[!] Error processing email ${email.messageId}:\n`, err.message || err);
            }
        }

    } catch (err) {
        console.error('Fatal execution error:', err);
    } finally {
        await mongoose.disconnect();
        console.log(`\nDisconnected from MongoDB.`);
    }
}

run();
