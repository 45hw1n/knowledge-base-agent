const gmailService = require('./gmailService');
const DebitEmailToProcess = require('../models/DebitEmailToProcess');
const UserPreferences = require('../models/UserPreferences');
const AppStatus = require('../models/AppStatus');
const { decodeBase64, extractEmailSnapshot } = require('../utils/helpers');
const { encryptClearText } = require('../utils/emailEncryption');
const { TRANSACTION_REGEX, NEGATIVE_REGEX, STORE_TRANSACTION_MAIL_THRESHOLD, MAX_SYNC_FAILURES } = require('../utils/Constants');
const { updateAppStatus } = require('../controllers/updateAppStatusController');
const { processDebitEmails } = require('./debitEmailProcessorService');

/**
 * Process a single email message
 * @param {string} userId - MongoDB user ID
 * @param {string} messageId - Gmail message ID
 * @returns {Object} - Processing result
 */
async function processEmail(userId, messageId) {
    console.log(`>>> Entering processEmail for messageId: ${messageId}`);
    try {
        // Fetch the full message
        const emailData = await gmailService.fetchMessage(userId, messageId);

        // Get subject and body
        const headers = emailData.payload.headers;
        const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h) => h.name === 'From')?.value || 'Unknown';
        const date = headers.find((h) => h.name === 'Date')?.value || 'Unknown Date';
        const body = extractEmailBody(emailData.payload);

        console.log(`Email processed:`, messageId);

        const result = checkDebitTransactionEmail({ messageId, from, subject, body, date });

        if (result?.confidenceScore > 0 && result.confidenceScore < STORE_TRANSACTION_MAIL_THRESHOLD) {
            console.log(
                `[NearMiss] messageId=${messageId} score=${result.confidenceScore} signals=[${result.matchedSignals.join(', ')}] subject="${subject}" from="${from}"`
            );
        }

        if (result?.confidenceScore >= STORE_TRANSACTION_MAIL_THRESHOLD) {
            const { metadata, encryptedCleanText, bodyHash, snippet, threadId } =
                await extractEmailSnapshot(emailData);
            const savedEmail = await saveDebitTransactionEmail(userId, { messageId, from, subject, body, date, transactionType: 'DEBIT', metadata, encryptedCleanText, bodyHash, threadId, snippet, _processed_result: result });

            // Auto-process if enabled (fire-and-forget)
            if (savedEmail?._id) {
                const prefs = await UserPreferences.findOne({ userId });
                if (prefs?.autoProcess) {
                    console.log(`[AutoProcess] Triggering for emailId=${savedEmail._id}`);
                    processDebitEmails({ ids: [savedEmail._id.toString()], userId })
                        .catch(err => console.error('[AutoProcess] Failed:', err.message));
                }
            }

            return { status: 'processed', isTransaction: true, messageId };
        }

        return { status: 'processed', isTransaction: false, messageId };
    } catch (error) {
        console.error(`Error processing email ${messageId}:`, error);
        throw error;
    }
}

/**
 * Sync recent emails since last sync time
 * @param {string} userId - MongoDB user ID
 * @returns {Object} - Sync results
 */
async function syncRecentEmails(userId) {
    try {
        const appStatus = await AppStatus.findOne({ userId });

        let query = 'category:inbox';

        if (appStatus && appStatus.emailLastSyncedAt) {
            const secondsSinceEpoch = Math.floor(appStatus.emailLastSyncedAt.getTime() / 1000);
            query += ` after:${secondsSinceEpoch}`;
        } else {
            query += ' newer_than:1d';
        }

        console.log('Syncing emails with query:', query);

        const messages = await gmailService.listMessages(userId, query);

        if (!messages || messages.length === 0) {
            console.log('No new emails to sync');
            return { success: true, processedCount: 0 };
        }

        let processedCount = 0;
        for (const messageRef of messages) {
            await processEmail(userId, messageRef.id);
            processedCount++;
        }

        await updateAppStatus(userId, {
            emailLastSyncedAt: new Date()
        });

        return { success: true, processedCount };
    } catch (error) {
        console.error('Error in syncRecentEmails:', error);
        throw error;
    }
}

function extractEmailBody(payload) {
    if (payload.body?.data) {
        return decodeBase64(payload.body.data);
    }

    if (payload.parts?.length) {
        const textPart = payload.parts.find((part) => part.mimeType === 'text/plain');
        if (textPart?.body?.data) {
            return decodeBase64(textPart.body.data);
        }

        const htmlPart = payload.parts.find((part) => part.mimeType === 'text/html');
        if (htmlPart?.body?.data) {
            return decodeBase64(htmlPart.body.data);
        }
    }

    return '[No readable body found]';
}

function checkDebitTransactionEmail(email) {
    const { from = '', subject = '', body = '' } = email;
    const text = `${subject} ${body}`.toLowerCase();

    if (NEGATIVE_REGEX.test(text)) {
        return { isTransaction: false, matchedSignals: [], confidenceScore: 0, reason: 'negative_keyword' };
    }

    const matches = {
        amount: TRANSACTION_REGEX.amount.test(text),
        debitVerbs: TRANSACTION_REGEX.debitVerbs.test(text),
        transactionWords: TRANSACTION_REGEX.transactionWords.test(text),
        financialSender: TRANSACTION_REGEX.financialSender.test(from.toLowerCase()),
        cardSuffix: TRANSACTION_REGEX.cardSuffix.test(text)
    };

    const strongSignals = ['amount', 'debitVerbs'];
    const weakSignals = ['transactionWords', 'financialSender', 'cardSuffix'];

    const matchedSignals = Object.entries(matches)
        .filter(([_, value]) => value)
        .map(([key]) => key);

    const hasStrongSignal = strongSignals.some(s => matches[s]);
    const weakSignalCount = weakSignals.filter(s => matches[s]).length;

    const isTransaction =
        hasStrongSignal &&
        (weakSignalCount >= 1 || (matches.amount && matches.debitVerbs));

    return {
        isTransaction,
        matchedSignals,
        confidenceScore: matchedSignals.length * 20
    };
}

function isEncrypted(value) {
    return value && typeof value === 'object' && value.iv && value.content && value.tag;
}

async function saveDebitTransactionEmail(userId, data) {
    try {
        const { messageId, from, subject, body, date, transactionType, _processed_result, metadata, encryptedCleanText, threadId, bodyHash, snippet } = data;

        const debitEmail = new DebitEmailToProcess({
            accountUserId: userId,
            messageId,
            from: isEncrypted(from) ? from : (encryptClearText(from) || null),
            subject: isEncrypted(subject) ? subject : (encryptClearText(subject) || null),
            body,
            date,
            // metadata,
            encryptedCleanText,
            bodyHash,
            threadId,
            snippet: isEncrypted(snippet) ? snippet : (encryptClearText(snippet) || null),
            transactionType,
            _processed_result,
            source: 'email',
            status: "DETECTED",
            LLMProcessedAt: null,
            LLMError: null,
            LLMProcessCount: 0
        });

        await debitEmail.save();
        console.log('✅ Debit email saved:', messageId);
        return debitEmail;
    } catch (error) {
        if (error.code === 11000) {
            console.log('ℹ️ Debit email already exists:', data.messageId);
        } else {
            console.error('❌ Error saving debit email:', error);
            throw error;
        }
    }
}

/**
 * Sync history since startHistoryId using Gmail History API
 * @param {string} userId - MongoDB user ID
 * @param {string} startHistoryId - Starting history ID
 * @param {Map<string,number>} [syncFailures] - Current failure counts per messageId (from AppStatus).
 *   Messages that have reached MAX_SYNC_FAILURES are treated as poison emails and skipped.
 * @returns {Object} - Sync results { processedCount, failedMessageIds, newestHistoryId }
 */
async function syncHistorySince(userId, startHistoryId, syncFailures = new Map()) {
    if (!startHistoryId) {
        console.log('No startHistoryId provided for history sync');
        return { processedCount: 0, failedMessageIds: [], newestHistoryId: null };
    }

    try {
        console.log(`>>> Starting syncHistorySince for user ${userId} from historyId ${startHistoryId}`);

        let allHistoryRecords = [];
        let latestHistoryId = startHistoryId || null;
        let pageToken = null;

        /**
         * 🔄 Pagination loop to fetch all mailbox events
         */
        do {
            const response = await gmailService.listHistory(userId, startHistoryId, pageToken);

            if (response.history) {
                allHistoryRecords = allHistoryRecords.concat(response.history);
            }

            if (response.historyId) {
                latestHistoryId = response.historyId;
            }
            pageToken = response.nextPageToken;

        } while (pageToken);

        if (allHistoryRecords.length === 0) {
            console.log('No history changes found');
            return {
                processedCount: 0,
                failedMessageIds: [],
                newestHistoryId: latestHistoryId
            };
        }

        // 1. Collect all messageAdded IDs
        const messageIdsToProcess = new Set();
        for (const record of allHistoryRecords) {
            if (record.messagesAdded) {
                for (const addition of record.messagesAdded) {
                    if (addition.message && addition.message.id) {
                        messageIdsToProcess.add(addition.message.id);
                    }
                }
            }
        }

        console.log(`Found ${messageIdsToProcess.size} unique messageAdded events in history`);

        let processedCount = 0;
        const failedMessageIds = [];

        for (const messageId of messageIdsToProcess) {
            // -- Poison-pill guard: skip permanently broken emails --
            // A message reaching MAX_SYNC_FAILURES is classified as a poison email.
            // We skip it so it no longer blocks historyId advancement.
            // The caller already incremented this count on previous failures.
            const priorFailures = syncFailures instanceof Map
                ? (syncFailures.get(messageId) || 0)
                : (syncFailures?.[messageId] || 0);

            if (priorFailures >= MAX_SYNC_FAILURES) {
                console.error(
                    `[syncHistorySince] ⚠️ Poison email detected — messageId=${messageId} ` +
                    `has failed ${priorFailures} times (>= MAX_SYNC_FAILURES=${MAX_SYNC_FAILURES}). Skipping permanently.`
                );
                continue;
            }

            try {
                // Check if message already exists in DB to ensure idempotency
                const exists = await DebitEmailToProcess.exists({ messageId });
                if (exists) {
                    console.log(`Skipping already processed message: ${messageId}`);
                    continue;
                }

                await processEmail(userId, messageId);
                processedCount++;
            } catch (error) {
                // Collect failure — do NOT swallow silently.
                // Caller will use this list to decide whether to advance historyId.
                console.error(`[syncHistorySince] ❌ Failed to process messageId=${messageId}:`, error.message);
                failedMessageIds.push(messageId);
            }
        }

        if (failedMessageIds.length > 0) {
            console.warn(
                `[syncHistorySince] ⚠️ ${failedMessageIds.length} message(s) failed: [${failedMessageIds.join(', ')}]. ` +
                `historyId will NOT be advanced by caller until retries are exhausted.`
            );
        }

        return {
            processedCount,
            failedMessageIds,
            newestHistoryId: latestHistoryId
        };
    } catch (error) {
        console.error('Error in syncHistorySince:', error);
        throw error;
    }
}

async function syncEmailsByLookback(userId, sinceDate) {
    try {
        const secondsSinceEpoch = Math.floor(sinceDate.getTime() / 1000);
        const query = `in:inbox after:${secondsSinceEpoch}`;

        console.log(`📦 Backfill search query: ${query}`);

        // ✅ FIXED: direct call
        const allMessages = await gmailService.listMessages(userId, query);

        if (allMessages.length === 0) {
            console.log('❌ No emails returned from Gmail API');
            return { success: true, processedCount: 0 };
        }

        console.log(`📨 Found ${allMessages.length} messages`);

        let processedCount = 0;

        for (const messageRef of allMessages) {
            try {
                const exists = await DebitEmailToProcess.exists({ messageId: messageRef.id });

                if (exists) continue;

                await processEmail(userId, messageRef.id);
                processedCount++;

            } catch (error) {
                console.error(`❌ Error processing ${messageRef.id}:`, error.message);
            }
        }

        await updateAppStatus(userId, {
            emailLastSyncedAt: new Date()
        });

        console.log(`✅ Backfill completed. Processed ${processedCount}`);

        return { success: true, processedCount };

    } catch (error) {
        console.error('❌ Error in syncEmailsByLookback:', error);
        throw error;
    }
}

module.exports = {
    processEmail,
    syncRecentEmails,
    syncHistorySince,
    syncEmailsByLookback
};
