const gmailService = require('./gmailService');
const EmailToProcess = require('../models/EmailToProcess');
const UserPreferences = require('../models/UserPreferences');
const AppStatus = require('../models/AppStatus');
const { extractEmailSnapshot } = require('../utils/helpers');
const { encryptClearText } = require('../utils/emailEncryption');
const { MAX_SYNC_FAILURES } = require('../utils/Constants');
const { updateAppStatus } = require('../controllers/updateAppStatusController');
const { processEmails } = require('./emailProcessorService');
const { classifyEmail } = require('../classifier');

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

        // Get subject and sender (used for logging/context only — the persisted body
        // text comes from extractEmailSnapshot below)
        const headers = emailData.payload.headers;
        const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h) => h.name === 'From')?.value || 'Unknown';
        const date = headers.find((h) => h.name === 'Date')?.value || 'Unknown Date';
        const attachments = extractAttachmentRefs(emailData.payload);

        console.log(`Email processed:`, messageId);

        const { metadata, encryptedCleanText, cleanText, bodyHash, snippet, threadId } =
            await extractEmailSnapshot(emailData);

        // Only emails the classifier recognizes as a plausible knowledge-base
        // entity (an invoice, ticket, payment, event, or document signal) are
        // queued at all — everything else (newsletters, personal mail,
        // marketing) is discarded here rather than persisted and processed.
        // classify() is a pure, side-effect-free function, so a duplicate
        // sync/webhook for a discarded message just re-derives the same
        // "not eligible" outcome — nothing needs to be tracked for it.
        const { candidates } = classifyEmail({
            subject: metadata.subject,
            from: metadata.from,
            bodyText: cleanText,
            snippet,
        });

        if (candidates.length === 0) {
            console.log(`[Classifier] messageId=${messageId} matched no entity type — discarding`);
            return { status: 'discarded', messageId };
        }

        const savedEmail = await saveEmailToProcess(userId, {
            messageId, from, subject, date, metadata, encryptedCleanText, bodyHash, threadId, snippet, attachments,
            classification: { candidates },
        });

        // Auto-process if enabled (fire-and-forget)
        if (savedEmail?._id) {
            const prefs = await UserPreferences.findOne({ userId });
            if (prefs?.autoProcess) {
                console.log(`[AutoProcess] Triggering for emailId=${savedEmail._id}`);
                processEmails({ ids: [savedEmail._id.toString()], userId })
                    .catch(err => console.error('[AutoProcess] Failed:', err.message));
            }
        }

        return { status: 'processed', messageId };
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

/**
 * Walk a Gmail message payload and collect references (not bytes) to every
 * part that represents an attachment — i.e. it has a filename and its body
 * is too large to be inlined (body.attachmentId instead of body.data).
 * Bytes are fetched lazily at extraction time via gmailService.fetchAttachment.
 */
function extractAttachmentRefs(payload, refs = []) {
    if (!payload) return refs;

    if (payload.filename && payload.body?.attachmentId) {
        refs.push({
            attachmentId: payload.body.attachmentId,
            filename: payload.filename,
            mimeType: payload.mimeType || 'application/octet-stream',
            size: payload.body.size ?? null
        });
    }

    if (payload.parts?.length) {
        for (const part of payload.parts) {
            extractAttachmentRefs(part, refs);
        }
    }

    return refs;
}

function isEncrypted(value) {
    return value && typeof value === 'object' && value.iv && value.content && value.tag;
}

async function saveEmailToProcess(userId, data) {
    try {
        const { messageId, from, subject, date, encryptedCleanText, threadId, bodyHash, snippet, attachments, classification } = data;

        const emailToProcess = new EmailToProcess({
            accountUserId: userId,
            messageId,
            from: isEncrypted(from) ? from : (encryptClearText(from) || null),
            subject: isEncrypted(subject) ? subject : (encryptClearText(subject) || null),
            date,
            encryptedCleanText,
            bodyHash,
            threadId,
            snippet: isEncrypted(snippet) ? snippet : (encryptClearText(snippet) || null),
            attachments: attachments || [],
            classification: classification || { candidates: [] },
            source: 'email',
            status: "DETECTED",
            LLMProcessedAt: null,
            LLMError: null,
            LLMProcessCount: 0
        });

        await emailToProcess.save();
        console.log('✅ Email queued for processing:', messageId);
        return emailToProcess;
    } catch (error) {
        if (error.code === 11000) {
            console.log('ℹ️ Email already queued:', data.messageId);
        } else {
            console.error('❌ Error saving email to process:', error);
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
                const exists = await EmailToProcess.exists({ messageId });
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
                const exists = await EmailToProcess.exists({ messageId: messageRef.id });

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
