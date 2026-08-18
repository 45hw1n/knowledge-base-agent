const User = require('../models/User');
const { GraphQLError, GraphQLScalarType, Kind } = require('graphql');
const { GraphQLUpload } = require('graphql-upload-minimal');
const syncEmailsService = require('../services/syncEmailsService');
const gmailService = require('../services/gmailService');
const debitEmailProcessorService = require('../services/debitEmailProcessorService');
const authService = require('../services/authService');
const { onboardUserService } = require('../services/onboardingService');
const userPreferencesService = require('../services/userPreferencesService');
const { updateAppStatus, updateAppStatusInternal } = require('../controllers/updateAppStatusController');
const AppStatus = require('../models/AppStatus');
const { MAX_SYNC_FAILURES } = require('../utils/Constants');
const attachmentService = require('../services/attachments/attachmentService');

function parseJsonLiteral(ast) {
    switch (ast.kind) {
        case Kind.STRING:
        case Kind.BOOLEAN:
            return ast.value;
        case Kind.INT:
        case Kind.FLOAT:
            return Number(ast.value);
        case Kind.OBJECT: {
            const value = {};
            for (const field of ast.fields) {
                value[field.name.value] = parseJsonLiteral(field.value);
            }
            return value;
        }
        case Kind.LIST:
            return ast.values.map(parseJsonLiteral);
        case Kind.NULL:
            return null;
        default:
            return null;
    }
}

const JSONScalar = new GraphQLScalarType({
    name: 'JSON',
    description: 'Arbitrary JSON scalar',
    serialize(value) {
        return value;
    },
    parseValue(value) {
        return value;
    },
    parseLiteral(ast) {
        return parseJsonLiteral(ast);
    }
});

const resolvers = {
    JSON: JSONScalar,
    Upload: GraphQLUpload,
    Query: {
        hello: () => 'Hello from GraphQL!',
        ping: () => 'pong',
        currentUser: (_, __, { req }) => {
            const user = authService.getCurrentUser(req);
            if (!user) return null;

            const { SCOPE_URL_TO_KEY } = require('../utils/Constants');
            const grantedScopesObj = {};

            if (user.grantedScopes && Array.isArray(user.grantedScopes)) {
                for (const scopeUrl of user.grantedScopes) {
                    const key = SCOPE_URL_TO_KEY[scopeUrl];
                    if (key) {
                        grantedScopesObj[key] = true;
                    }
                }
            }

            return {
                id: user._id,
                displayName: user.displayName,
                email: user.email,
                image: user.image,
                grantedScopes: Object.keys(grantedScopesObj).length > 0 ? grantedScopesObj : null,
                gmailAuthRevoked: user.gmailAuthRevoked ?? false,
            };
        },
        getAppStatus: async (_, __, { user }) => {
            if (!user) {
                throw new Error('Unauthorized');
            }

            const appStatus = await AppStatus.findOne({ userId: user._id });

            if (!appStatus) {
                const result = {
                    userId: user._id,
                    onboarded: false,
                    emailLastSyncedAt: null,
                    emailSyncStatus: "IDLE",
                    debitProcessingInProgress: false,
                    lastDebitAIProcessStartedAt: null,
                    lastDebitAIProcessCompletedAt: null,
                    lastDebitAIProcessedCount: 0
                };
                console.log("Final returned object (fallback):", result);
                return result;
            }

            const result = {
                userId: appStatus.userId,
                onboarded: appStatus.onboarded,
                emailLastSyncedAt: appStatus.emailLastSyncedAt,
                emailSyncStatus: appStatus.emailSyncStatus || "IDLE",
                debitProcessingInProgress: appStatus.debitProcessingInProgress || false,
                lastDebitAIProcessStartedAt: appStatus.lastDebitAIProcessStartedAt || null,
                lastDebitAIProcessCompletedAt: appStatus.lastDebitAIProcessCompletedAt || null,
                lastDebitAIProcessedCount: appStatus.lastDebitAIProcessedCount || 0
            };
            return result;
        },
        getUserPreferences: async (_, __, { user }) => {
            if (!user) {
                throw new Error('Unauthorized');
            }

            return await userPreferencesService.getUserPreferences(user._id);
        },
        getDebitEmailsToProcess: async (_, __, { user }) => {
            if (!user) {
                return {
                    count: 0,
                    ids: [],
                };
            }

            try {
                console.log(`Fetching debit emails to process for user: ${user.displayName}`);

                const result = await debitEmailProcessorService.getDebitEmailsToProcess(user._id);

                return {
                    count: result.count,
                    ids: result.ids,
                };
            } catch (error) {
                console.error('Error in getDebitEmailsToProcess:', error);

                return {
                    count: 0,
                    ids: [],
                };
            }
        },
        getDebitEmailsToProcessByStatus: async (_, { input }, { user }) => {
            if (!user) {
                return {
                    count: 0,
                    data: [],
                };
            }

            const { statuses = [] } = input || {};

            if (!statuses.length) {
                return {
                    count: 0,
                    data: [],
                };
            }

            try {
                console.log(
                    `Fetching debit emails for user: ${user.displayName}, statuses: ${statuses.join(',')}`
                );

                const result =
                    await debitEmailProcessorService.getDebitEmailsToProcessByStatus(
                        user._id,
                        statuses
                    );

                return result;
            } catch (error) {
                console.error('Error in getDebitEmailsToProcessByStatus:', error);

                return {
                    count: 0,
                    data: [],
                };
            }
        },
        loginWithGoogle: (_, __, { req }) => authService.getGoogleLoginUrl(req),
        getAttachmentDownloadUrl: async (_, { input }, { user }) => {
            if (!user) {
                throw new GraphQLError('User not authenticated', { extensions: { code: 'UNAUTHORIZED' } });
            }

            try {
                return await attachmentService.getAttachmentDownloadUrl(
                    user._id,
                    input.entityType,
                    input.entityId,
                    input.attachmentId
                );
            } catch (error) {
                throw new GraphQLError(error.message, {
                    extensions: { code: error.code || 'INTERNAL_ERROR' }
                });
            }
        },
    },
    Mutation: {
        logout: async (_, __, { req, res }) => await authService.logout(req, res),
        onboardUser: async (_, { input }, { user }) => {
            if (!user) throw new Error('User not authenticated');
            return onboardUserService(user._id, input);
        },
        updateUserPreferences: async (_, { input }, { user }) => {
            if (!user) {
                throw new Error('User not authenticated');
            }

            try {
                return await userPreferencesService.updateUserPreferences(user._id, input);
            } catch (error) {
                console.error('Error in updateUserPreferences resolver:', error);
                throw new Error(`Failed to update user preferences: ${error.message}`);
            }
        },
        syncEmails: async (_, __, { user }) => {
            if (!user) {
                return {
                    success: false,
                    message: 'User not authenticated',
                    processedCount: 0,
                };
            }

            try {
                console.log(`Starting syncEmails for user: ${user.displayName}`);

                const appStatus = await AppStatus.findOne({ userId: user._id });

                if (!appStatus?.onboarded) {
                    console.log(`${user.displayName} :: ${user._id} :: User not onboarded`);
                    return {
                        success: false,
                        message: 'User not onboarded',
                        processedCount: 0,
                    };
                }

                // Atomic Lock Acquisition
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
                    { $set: { emailSyncStatus: 'SYNC_IN_PROGRESS', syncStartedAt: new Date() } },
                    { emailSyncStatus: 'IDLE' }
                );

                if (!lock) {
                    console.log(`${user.displayName} :: ${user._id} :: Another sync already in progress`);
                    return {
                        success: false,
                        message: 'Another sync already in progress',
                        processedCount: 0,
                    };
                }

                try {
                    console.log(`${user.displayName} :: ${user._id} :: Acquired lock for sync`);
                    // 0. Capture current historyId before watch setup
                    const userFromDb = await User.findById(user._id);
                    const startHistoryId = userFromDb?.historyId;

                    // 1. Ensure Gmail Watch is setup/renewed (The "Ignition Switch")
                    await gmailService.setupWatch(user._id);

                    let totalProcessedCount = 0;

                    // 2. Try history-based sync if we have a cursor
                    if (startHistoryId) {
                        console.log(`${user.displayName} :: ${user._id} :: Trying history-based sync`);

                        // Load syncFailures to skip poison emails and classify failures after sync
                        const currentAppStatus = await AppStatus.findOne({ userId: user._id });
                        const syncFailures = currentAppStatus?.syncFailures || new Map();

                        const historyResult = await syncEmailsService.syncHistorySince(
                            user._id,
                            startHistoryId,
                            syncFailures
                        );

                        totalProcessedCount += historyResult.processedCount;

                        // ── Safe historyId advancement (mirrors webhook logic) ──────────────
                        if (historyResult.failedMessageIds && historyResult.failedMessageIds.length > 0) {
                            // Atomically increment failure counters
                            const incOps = {};
                            for (const msgId of historyResult.failedMessageIds) {
                                incOps[`syncFailures.${msgId}`] = 1;
                            }
                            await updateAppStatusInternal(user._id, { $inc: incOps });

                            // Determine retryable failures (check count BEFORE increment)
                            const retryableFailures = historyResult.failedMessageIds.filter(id => {
                                const count = syncFailures instanceof Map
                                    ? (syncFailures.get(id) || 0)
                                    : (syncFailures?.[id] || 0);
                                return (count + 1) < MAX_SYNC_FAILURES;
                            });

                            if (retryableFailures.length > 0) {
                                console.warn(
                                    `[syncEmails] Retaining historyId=${startHistoryId} — ` +
                                    `${retryableFailures.length} retryable failure(s): [${retryableFailures.join(', ')}]`
                                );
                            } else {
                                // All failures are now poison — advance so we don't block forever
                                console.error(
                                    `[syncEmails] All failures exhausted (>= ${MAX_SYNC_FAILURES} retries). ` +
                                    `Advancing historyId to unblock pipeline.`
                                );
                                if (historyResult.newestHistoryId) {
                                    const currentHId = BigInt(startHistoryId);
                                    const newHId = BigInt(historyResult.newestHistoryId);
                                    if (newHId > currentHId) {
                                        await User.updateOne(
                                            { _id: user._id },
                                            { $set: { historyId: historyResult.newestHistoryId } }
                                        );
                                    }
                                }
                            }
                        } else if (historyResult.newestHistoryId) {
                            // ✅ No failures — advance cursor normally
                            const currentHId = startHistoryId ? BigInt(startHistoryId) : BigInt(0);
                            const newHId = BigInt(historyResult.newestHistoryId);
                            if (newHId > currentHId) {
                                await User.updateOne(
                                    { _id: user._id },
                                    { $set: { historyId: historyResult.newestHistoryId } }
                                );
                            }
                        }

                    } // end if (startHistoryId)

                    // 3. Perform old historical catch-up sync (timestamp-based) as fallback/backup
                    console.log(`${user.displayName} :: ${user._id} :: Performing old historical catch-up sync`);
                    const result = await syncEmailsService.syncRecentEmails(user._id);
                    totalProcessedCount += result.processedCount;

                    return {
                        success: true,
                        message: 'Emails synced and Gmail watch initialized',
                        processedCount: totalProcessedCount,
                    };
                } finally {
                    console.log(`${user.displayName} :: ${user._id} :: Releasing lock`);
                    // Release lock
                    await updateAppStatusInternal(user._id, {
                        $set: { emailSyncStatus: 'IDLE' },
                        $unset: { syncStartedAt: '' }
                    });
                }
            } catch (error) {
                console.error('Error in syncEmails mutation:', error);

                // Ensure lock is released even on errors not caught by inner try
                // Lock is only ever released in the inner finally block.
                // If acquisition itself failed, we never held the lock — do not touch it.

                return {
                    success: false,
                    message: `Sync failed: ${error.message}`,
                    processedCount: 0,
                };
            }
        },
        backfillEmails: async (_, { input }, { user }) => {
            if (!user) {
                return {
                    success: false,
                    message: 'User not authenticated',
                    processedCount: 0,
                };
            }

            const { lookback, sinceDate, mode = 'STANDARD' } = input;

            if (!lookback && !sinceDate) {
                return {
                    success: false,
                    message: 'Provide lookback or sinceDate',
                    processedCount: 0,
                };
            }

            if (lookback && sinceDate) {
                return {
                    success: false,
                    message: 'Provide only one: lookback or sinceDate',
                    processedCount: 0,
                };
            }

            try {
                console.log(`Starting backfillEmails for user: ${user.displayName} (Mode: ${mode})`);

                const appStatus = await AppStatus.findOne({ userId: user._id });

                if (!appStatus) {
                    return {
                        success: false,
                        message: 'App status not initialized',
                        processedCount: 0,
                    };
                }

                if (mode === 'STANDARD' && !appStatus?.onboarded) {
                    return {
                        success: false,
                        message: 'User not onboarded',
                        processedCount: 0,
                    };
                }

                // Atomic Lock Acquisition
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
                    { $set: { emailSyncStatus: 'SYNC_IN_PROGRESS', syncStartedAt: new Date() } },
                    { emailSyncStatus: 'IDLE' }
                );

                if (!lock) {
                    return {
                        success: false,
                        message: 'Another sync already in progress',
                        processedCount: 0,
                    };
                }

                try {
                    let sinceDateObj;

                    if (lookback) {
                        const now = new Date();
                        const value = lookback.value;
                        const unit = lookback.unit;

                        if (unit !== 'DAYS') {
                            throw new Error('Only "DAYS" lookback unit is supported');
                        }

                        if (!Number.isInteger(value) || value <= 0 || value > 3650) {
                            throw new Error('Lookback days must be between 1 and 3650');
                        }

                        sinceDateObj = new Date(now.getTime() - (value * 86400000));
                    } else {
                        sinceDateObj = new Date(sinceDate);

                        if (isNaN(sinceDateObj.getTime())) {
                            throw new Error('Invalid sinceDate format (expected YYYY-MM-DD)');
                        }

                        if (sinceDateObj > new Date()) {
                            throw new Error('sinceDate cannot be in the future');
                        }
                    }

                    // Call service method
                    const result = await syncEmailsService.syncEmailsByLookback(user._id, sinceDateObj);

                    console.log(`processed: ${result.processedCount} | Historical emails backfilled from ${sinceDateObj.toISOString()}`)

                    return {
                        success: true,
                        message: `Historical emails backfilled from ${sinceDateObj.toISOString()}`,
                        processedCount: result.processedCount,
                    };
                } finally {
                    // Release lock
                    await updateAppStatusInternal(user._id, {
                        $set: { emailSyncStatus: 'IDLE' },
                        $unset: { syncStartedAt: '' }
                    });
                }
            } catch (error) {
                console.error('Error in backfillEmails mutation:', error);

                return {
                    success: false,
                    message: `Backfill failed: ${error.message}`,
                    processedCount: 0,
                };
            }
        },
        processDebitEmails: async (_, { input = {} }, { user }) => {
            if (!user) {
                return {
                    success: false,
                    message: 'User not authenticated',
                    queuedCount: 0,
                };
            }

            const lockTimeout = new Date(Date.now() - 5 * 60 * 1000);
            await updateAppStatusInternal(
                user._id,
                { $set: { debitProcessingInProgress: false } },
                {
                    debitProcessingInProgress: true,
                    lastDebitAIProcessStartedAt: { $lt: lockTimeout }
                }
            );

            const lock = await updateAppStatusInternal(
                user._id,
                { $set: {
                    debitProcessingInProgress: true,
                    lastDebitAIProcessStartedAt: new Date(),
                    lastDebitAIProcessedCount: 0
                } },
                { debitProcessingInProgress: { $ne: true } }
            );

            if (!lock) {
                console.log(`[processDebitEmails] Already in progress for user: ${user.displayName}`);
                return {
                    success: true,
                    message: 'Processing already in progress',
                    queuedCount: 0,
                };
            }

            try {
                console.log(`Starting processDebitEmails for user: ${user.displayName}`);
                const result = await debitEmailProcessorService.processDebitEmails({
                    ...input,
                    userId: user._id,
                });

                await updateAppStatusInternal(
                    user._id,
                    { $set: {
                        lastDebitAIProcessCompletedAt: new Date(),
                        lastDebitAIProcessedCount: result.queuedCount
                    } }
                );

                return {
                    success: true,
                    message: `Queued ${result.queuedCount} emails for processing`,
                    queuedCount: result.queuedCount,
                };
            } catch (error) {
                console.error('Error in processDebitEmails mutation:', error);
                return {
                    success: false,
                    message: `Processing failed: ${error.message}`,
                    queuedCount: 0,
                };
            } finally {
                await updateAppStatusInternal(
                    user._id,
                    { $set: { debitProcessingInProgress: false } }
                );
            }
        },
        testMutation: (_, { input }) => `You sent: ${input}`,
        updateAppStatus: async (_, { input }, { user }) => {
            if (!user) {
                throw new Error('User not authenticated');
            }

            try {
                return await updateAppStatus(user._id, input);
            } catch (error) {
                console.error('Error in updateAppStatus mutation:', error);
                throw error;
            }
        },
        uploadAttachments: async (_, { input }, { user }) => {
            if (!user) {
                throw new GraphQLError('User not authenticated', { extensions: { code: 'UNAUTHORIZED' } });
            }

            try {
                return await attachmentService.uploadAttachments(
                    user._id,
                    input.entityType,
                    input.entityId,
                    input.files
                );
            } catch (error) {
                throw new GraphQLError(error.message, {
                    extensions: { code: error.code || 'INTERNAL_ERROR' }
                });
            }
        },
        deleteAttachment: async (_, { input }, { user }) => {
            if (!user) {
                throw new GraphQLError('User not authenticated', { extensions: { code: 'UNAUTHORIZED' } });
            }

            try {
                return await attachmentService.deleteAttachment(
                    user._id,
                    input.entityType,
                    input.entityId,
                    input.attachmentId
                );
            } catch (error) {
                throw new GraphQLError(error.message, {
                    extensions: { code: error.code || 'INTERNAL_ERROR' }
                });
            }
        },
    }
};

module.exports = resolvers;
