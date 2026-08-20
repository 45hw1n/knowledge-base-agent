const User = require('../models/User');
const { GraphQLError, GraphQLScalarType, Kind } = require('graphql');
const { GraphQLUpload } = require('graphql-upload-minimal');
const syncEmailsService = require('../services/syncEmailsService');
const gmailService = require('../services/gmailService');
const emailProcessorService = require('../services/emailProcessorService');
const authService = require('../services/authService');
const userPreferencesService = require('../services/userPreferencesService');
const { updateAppStatus, updateAppStatusInternal } = require('../controllers/updateAppStatusController');
const AppStatus = require('../models/AppStatus');
const { reconcileSyncFailures } = require('../services/syncFailureTracker');
const attachmentService = require('../services/attachments/attachmentService');
const listingService = require('../services/listingService');
const Entity = require('../models/Entity');

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
                    emailLastSyncedAt: null,
                    emailSyncStatus: "IDLE",
                    emailProcessingInProgress: false,
                    lastEmailAIProcessStartedAt: null,
                    lastEmailAIProcessCompletedAt: null,
                    lastEmailAIProcessedCount: 0
                };
                console.log("Final returned object (fallback):", result);
                return result;
            }

            const result = {
                userId: appStatus.userId,
                emailLastSyncedAt: appStatus.emailLastSyncedAt,
                emailSyncStatus: appStatus.emailSyncStatus || "IDLE",
                emailProcessingInProgress: appStatus.emailProcessingInProgress || false,
                lastEmailAIProcessStartedAt: appStatus.lastEmailAIProcessStartedAt || null,
                lastEmailAIProcessCompletedAt: appStatus.lastEmailAIProcessCompletedAt || null,
                lastEmailAIProcessedCount: appStatus.lastEmailAIProcessedCount || 0
            };
            return result;
        },
        getUserPreferences: async (_, __, { user }) => {
            if (!user) {
                throw new Error('Unauthorized');
            }

            return await userPreferencesService.getUserPreferences(user._id);
        },
        getEmailsToProcess: async (_, __, { user }) => {
            if (!user) {
                return {
                    count: 0,
                    ids: [],
                };
            }

            try {
                console.log(`Fetching emails to process for user: ${user.displayName}`);

                const result = await emailProcessorService.getEmailsToProcess(user._id);

                return {
                    count: result.count,
                    ids: result.ids,
                };
            } catch (error) {
                console.error('Error in getEmailsToProcess:', error);

                return {
                    count: 0,
                    ids: [],
                };
            }
        },
        getEmailsToProcessByStatus: async (_, { input }, { user }) => {
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
                    `Fetching emails for user: ${user.displayName}, statuses: ${statuses.join(',')}`
                );

                const result =
                    await emailProcessorService.getEmailsToProcessByStatus(
                        user._id,
                        statuses
                    );

                return result;
            } catch (error) {
                console.error('Error in getEmailsToProcessByStatus:', error);

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
        entities: async (_, { input }, { user }) => {
            if (!user) {
                throw new GraphQLError('User not authenticated', { extensions: { code: 'UNAUTHORIZED' } });
            }

            try {
                return await listingService.listEntities(input, { userId: user._id });
            } catch (error) {
                const mapped = listingService.mapListError(error);
                throw new GraphQLError(mapped.message, { extensions: { code: mapped.code } });
            }
        },
        entity: async (_, { id }, { user }) => {
            if (!user) {
                throw new GraphQLError('User not authenticated', { extensions: { code: 'UNAUTHORIZED' } });
            }

            const entity = await Entity.findOne({ _id: id, userId: user._id }).lean();
            if (!entity) return null;

            return {
                id: entity._id.toString(),
                entityType: entity.entityType,
                data: entity.data,
                sourceType: entity.sourceType,
                sourceEmailId: entity.sourceEmailId ? entity.sourceEmailId.toString() : null,
                sourceAttachmentId: entity.sourceAttachmentId || null,
                rawTextSnippet: entity.rawTextSnippet || null,
                confidence: entity.confidence ?? null,
                status: entity.status,
                extractedAt: entity.extractedAt?.toISOString?.() || null,
                createdAt: entity.createdAt?.toISOString?.() || null,
                updatedAt: entity.updatedAt?.toISOString?.() || null
            };
        },
    },
    Mutation: {
        logout: async (_, __, { req, res }) => await authService.logout(req, res),
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

                    // 1. Ensure Gmail Watch is setup/renewed (The "Ignition Switch").
                    // Non-fatal, same as the login-triggered sync in passport.js: a
                    // broken/missing Pub/Sub topic should degrade push notifications,
                    // not block this pull-based sync from running at all.
                    try {
                        await gmailService.setupWatch(user._id);
                    } catch (watchError) {
                        console.error(`${user.displayName} :: ${user._id} :: Gmail watch setup failed (continuing with pull sync):`, watchError.message);
                    }

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

                        // ── Safe historyId advancement (shared policy — see syncFailureTracker) ──
                        await reconcileSyncFailures({
                            userId: user._id,
                            failedMessageIds: historyResult.failedMessageIds,
                            priorSyncFailures: syncFailures,
                            context: '[syncEmails]',
                            onAdvance: async () => {
                                if (!historyResult.newestHistoryId) return;
                                const currentHId = startHistoryId ? BigInt(startHistoryId) : BigInt(0);
                                const newHId = BigInt(historyResult.newestHistoryId);
                                if (newHId > currentHId) {
                                    await User.updateOne(
                                        { _id: user._id },
                                        { $set: { historyId: historyResult.newestHistoryId } }
                                    );
                                }
                            },
                        });

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

            const { lookback, sinceDate } = input;

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
                console.log(`Starting backfillEmails for user: ${user.displayName}`);

                const appStatus = await AppStatus.findOne({ userId: user._id });

                if (!appStatus) {
                    return {
                        success: false,
                        message: 'App status not initialized',
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
        processEmails: async (_, { input = {} }, { user }) => {
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
                { $set: { emailProcessingInProgress: false } },
                {
                    emailProcessingInProgress: true,
                    lastEmailAIProcessStartedAt: { $lt: lockTimeout }
                }
            );

            const lock = await updateAppStatusInternal(
                user._id,
                { $set: {
                    emailProcessingInProgress: true,
                    lastEmailAIProcessStartedAt: new Date(),
                    lastEmailAIProcessedCount: 0
                } },
                { emailProcessingInProgress: { $ne: true } }
            );

            if (!lock) {
                console.log(`[processEmails] Already in progress for user: ${user.displayName}`);
                return {
                    success: true,
                    message: 'Processing already in progress',
                    queuedCount: 0,
                };
            }

            try {
                console.log(`Starting processEmails for user: ${user.displayName}`);
                const result = await emailProcessorService.processEmails({
                    ...input,
                    userId: user._id,
                });

                await updateAppStatusInternal(
                    user._id,
                    { $set: {
                        lastEmailAIProcessCompletedAt: new Date(),
                        lastEmailAIProcessedCount: result.queuedCount
                    } }
                );

                return {
                    success: true,
                    message: `Queued ${result.queuedCount} emails for processing`,
                    queuedCount: result.queuedCount,
                };
            } catch (error) {
                console.error('Error in processEmails mutation:', error);
                return {
                    success: false,
                    message: `Processing failed: ${error.message}`,
                    queuedCount: 0,
                };
            } finally {
                await updateAppStatusInternal(
                    user._id,
                    { $set: { emailProcessingInProgress: false } }
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
