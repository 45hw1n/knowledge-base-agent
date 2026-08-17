const User = require('../models/User');
const Field = require('../models/Field');
const { GraphQLError, GraphQLScalarType, Kind } = require('graphql');
const { GraphQLUpload } = require('graphql-upload-minimal');
const syncEmailsService = require('../services/syncEmailsService');
const gmailService = require('../services/gmailService');
const debitEmailProcessorService = require('../services/debitEmailProcessorService');
const authService = require('../services/authService');
const bankAccountService = require('../services/bankAccountService');
const creditCardService = require('../services/creditCardService');
const { onboardUserService } = require('../services/onboardingService');
const userPreferencesService = require('../services/userPreferencesService');
const { updateAppStatus, updateAppStatusInternal } = require('../controllers/updateAppStatusController');
const AppStatus = require('../models/AppStatus');
const { MAX_SYNC_FAILURES } = require('../utils/Constants');
const listingService = require('../services/listingService');
const transactionReviewListService = require('../services/transactionReviewListService');
const transactionListService = require('../services/transactionListService');
const getTransactionWidgetsService = require('../services/getTransactionWidgetsService');
const transactionsToReviewService = require('../services/transactionsToReviewService');
const transactionService = require('../services/transactionService');
const transactionExportService = require('../services/transactionExportService');
const { normalizeTransaction } = require('../services/transactionListService');
const {
    normalizeTransactionToReview,
    buildInstrumentMap
} = require('../services/transactionReviewListService');
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
                    lastDebitAIProcessedCount: 0,
                    showPrivateEntity: false
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
                lastDebitAIProcessedCount: appStatus.lastDebitAIProcessedCount || 0,
                showPrivateEntity: appStatus.showPrivateEntity ?? false
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
        getSheetsAuthUrl: (_, __, { user }) => {
            if (!user) throw new Error('Unauthorized');
            return `${process.env.GOOGLE_AUTH_BASE_URL}/auth/google/sheets`;
        },
        getBankAccounts: async (_, __, { user }) => {
            if (!user) throw new Error('Unauthorized');
            return await bankAccountService.getBankAccounts(user._id);
        },
        getBankAccount: async (_, { id }, { user }) => {
            if (!user) throw new Error('Unauthorized');
            return await bankAccountService.getBankAccountById(user._id, id);
        },
        getCreditCards: async (_, __, { user }) => {
            if (!user) throw new Error('Unauthorized');
            return await creditCardService.getCreditCards(user._id);
        },
        getCreditCard: async (_, { id }, { user }) => {
            if (!user) throw new Error('Unauthorized');
            return await creditCardService.getCreditCardById(user._id, id);
        },
        listCreditCards: async (_, { input }, { user }) => {
            if (!user) {
                throw new GraphQLError('User not authenticated', {
                    extensions: { code: 'UNAUTHORIZED' }
                });
            }

            try {
                return await listingService.listCreditCards(input, { userId: user._id });
            } catch (error) {
                const mapped = listingService.mapListError(error);
                throw new GraphQLError(mapped.message, {
                    extensions: { code: mapped.code }
                });
            }
        },
        getTransactions: async (_, { input }, { user }) => {
            if (!user) {
                throw new GraphQLError('User not authenticated', {
                    extensions: { code: 'UNAUTHORIZED' }
                });
            }
            try {
                return await transactionListService.listTransactions(input || {}, {
                    userId: user._id
                });
            } catch (error) {
                const mapped = listingService.mapListError(error);
                throw new GraphQLError(mapped.message, {
                    extensions: { code: mapped.code }
                });
            }
        },
        getTransactionsToReview: async (_, { input }, { user }) => {
            if (!user) {
                throw new GraphQLError('User not authenticated', {
                    extensions: { code: 'UNAUTHORIZED' }
                });
            }

            try {
                return await transactionReviewListService.listTransactionsToReview(input || {}, {
                    userId: user._id
                });
            } catch (error) {
                const mapped = listingService.mapListError(error);
                throw new GraphQLError(mapped.message, {
                    extensions: { code: mapped.code }
                });
            }
        },
        getTransactionWidgets: async (_, { input }, { user }) => {
            if (!user) {
                throw new GraphQLError('User not authenticated', {
                    extensions: { code: 'UNAUTHORIZED' }
                });
            }

            try {
                return await getTransactionWidgetsService.getTransactionWidgets(input, {
                    userId: user._id
                });
            } catch (error) {
                const mapped = listingService.mapListError(error);
                throw new GraphQLError(mapped.message, {
                    extensions: { code: mapped.code }
                });
            }
        },
        getFieldsMeta: async (_, __, { user }) => {
            if (!user) throw new GraphQLError('User not authenticated', { extensions: { code: 'UNAUTHORIZED' } });
            return Field.find(
                {},
                { id: 1, name: 1, label: 1, isActive: 1, isCustom: 1, nestedTo: 1, _id: 0 }
            ).lean();
        },
        getFieldOptions: async (_, { fieldName, parentId }, { user }) => {
            if (!user) throw new GraphQLError('User not authenticated', { extensions: { code: 'UNAUTHORIZED' } });
            const field = await Field.findOne(
                { name: fieldName, isActive: true },
                { values: 1, _id: 0 }
            ).lean();
            if (!field) return [];
            const active = field.values.filter(v => v.isActive);
            const filtered = parentId
                ? active.filter(v => v.nestedTo?.valueId === parentId)
                : active;
            return filtered.map(({ id, value, label }) => ({ id, value, label }));
        },
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
        createBankAccount: async (_, { input }, { user }) => {
            if (!user) {
                return { success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
            }
            try {
                const newAccount = await bankAccountService.createBankAccount(user._id, input);
                return { success: true, data: newAccount, error: null };
            } catch (error) {
                return {
                    success: false,
                    data: null,
                    error: {
                        code: error.code || 'INTERNAL_ERROR',
                        message: error.message
                    }
                };
            }
        },
        updateBankAccount: async (_, { id, input }, { user }) => {
            if (!user) {
                return { success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
            }
            try {
                const updatedAccount = await bankAccountService.updateBankAccount(user._id, id, input);
                return { success: true, data: updatedAccount, error: null };
            } catch (error) {
                return {
                    success: false,
                    data: null,
                    error: {
                        code: error.message.includes('not found') ? 'NOT_FOUND' : 'BAD_REQUEST',
                        message: error.message
                    }
                };
            }
        },
        deleteBankAccount: async (_, { id }, { user }) => {
            if (!user) {
                return { success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
            }
            try {
                const deletedAccount = await bankAccountService.deleteBankAccount(user._id, id);
                return { success: true, data: deletedAccount, error: null };
            } catch (error) {
                return {
                    success: false,
                    data: null,
                    error: {
                        code: error.message.includes('not found') ? 'NOT_FOUND' : 'BAD_REQUEST',
                        message: error.message
                    }
                };
            }
        },
        createCreditCard: async (_, { input }, { user }) => {
            if (!user) return { success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
            try {
                const newCard = await creditCardService.createCreditCard(user._id, input);
                return { success: true, data: newCard, error: null };
            } catch (error) {
                return {
                    success: false,
                    data: null,
                    error: {
                        code: error.code || 'INTERNAL_ERROR',
                        message: error.message
                    }
                };
            }
        },
        updateCreditCard: async (_, { id, input }, { user }) => {
            if (!user) return { success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
            try {
                const updatedCard = await creditCardService.updateCreditCard(user._id, id, input);
                return { success: true, data: updatedCard, error: null };
            } catch (error) {
                return {
                    success: false,
                    data: null,
                    error: {
                        code: error.code || 'INTERNAL_ERROR',
                        message: error.message
                    }
                };
            }
        },
        deleteCreditCard: async (_, { id }, { user }) => {
            if (!user) return { success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
            try {
                const deletedCard = await creditCardService.deleteCreditCard(user._id, id);
                return { success: true, data: deletedCard, error: null };
            } catch (error) {
                return {
                    success: false,
                    data: null,
                    error: {
                        code: error.code || 'INTERNAL_ERROR',
                        message: error.message
                    }
                };
            }
        },
        approveTransaction: async (_, { input }, { user }) => {
            if (!user) {
                return {
                    success: false,
                    transaction: null,
                    review: null,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
                };
            }

            try {
                const { review, transaction } = await transactionsToReviewService.approve(
                    user._id,
                    input.reviewId,
                    input.changes || {}
                );

                const instrumentMap = await buildInstrumentMap([review]);

                return {
                    success: true,
                    transaction: normalizeTransaction(transaction),
                    review: normalizeTransactionToReview(review, instrumentMap),
                    error: null
                };
            } catch (error) {
                const code = error.code && ['UNAUTHORIZED', 'NOT_FOUND', 'INVALID_STATE', 'VALIDATION_ERROR'].includes(error.code)
                    ? error.code
                    : error.name === 'ValidationError'
                        ? 'VALIDATION_ERROR'
                        : 'INTERNAL_ERROR';

                return {
                    success: false,
                    transaction: null,
                    review: null,
                    error: {
                        code,
                        message: error.message
                    }
                };
            }
        },
        rejectTransaction: async (_, { input }, { user }) => {
            if (!user) {
                return {
                    success: false,
                    review: null,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
                };
            }

            try {
                const { review } = await transactionsToReviewService.reject(
                    user._id,
                    input.transactionId,
                    input.notes
                );

                const instrumentMap = await buildInstrumentMap([review]);

                return {
                    success: true,
                    review: normalizeTransactionToReview(review, instrumentMap),
                    error: null
                };
            } catch (error) {
                const code = error.code && ['UNAUTHORIZED', 'NOT_FOUND', 'INVALID_STATE', 'VALIDATION_ERROR'].includes(error.code)
                    ? error.code
                    : error.name === 'ValidationError'
                        ? 'VALIDATION_ERROR'
                        : 'INTERNAL_ERROR';

                return {
                    success: false,
                    review: null,
                    error: {
                        code,
                        message: error.message
                    }
                };
            }
        },
        createTransaction: async (_, { input }, { user }) => {
            if (!user) {
                return {
                    success: false,
                    transaction: null,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
                };
            }

            try {
                const transaction = await transactionService.createManual(
                    user._id,
                    input
                );

                return {
                    success: true,
                    transaction: normalizeTransaction(transaction),
                    error: null
                };
            } catch (error) {
                const code = error.code && ['UNAUTHORIZED', 'NOT_FOUND', 'VALIDATION_ERROR'].includes(error.code)
                    ? error.code
                    : error.name === 'ValidationError'
                        ? 'VALIDATION_ERROR'
                        : 'INTERNAL_ERROR';

                return {
                    success: false,
                    transaction: null,
                    error: {
                        code,
                        message: error.message
                    }
                };
            }
        },
        editTransaction: async (_, { input }, { user }) => {
            if (!user) {
                return {
                    success: false,
                    transaction: null,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
                };
            }

            try {
                const transaction = await transactionService.editTransaction(
                    user._id,
                    input.transactionId,
                    input.changes || {},
                    input.deleteAttachments || []
                );

                return {
                    success: true,
                    transaction: normalizeTransaction(transaction),
                    error: null
                };
            } catch (error) {
                const code = error.code && ['UNAUTHORIZED', 'NOT_FOUND', 'VALIDATION_ERROR'].includes(error.code)
                    ? error.code
                    : error.name === 'ValidationError'
                        ? 'VALIDATION_ERROR'
                        : 'INTERNAL_ERROR';

                return {
                    success: false,
                    transaction: null,
                    error: {
                        code,
                        message: error.message
                    }
                };
            }
        },
        deleteTransaction: async (_, { input }, { user }) => {
            if (!user) {
                return {
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
                };
            }

            try {
                await transactionService.deleteTransaction(user._id, input.transactionId);

                return {
                    success: true,
                    error: null
                };
            } catch (error) {
                const code = error.code && ['UNAUTHORIZED', 'NOT_FOUND', 'VALIDATION_ERROR'].includes(error.code)
                    ? error.code
                    : 'INTERNAL_ERROR';

                return {
                    success: false,
                    error: {
                        code,
                        message: error.message
                    }
                };
            }
        },
        exportTransactions: async (_, { input }, { user }) => {
            if (!user) {
                return {
                    success: false,
                    fileName: null,
                    mimeType: null,
                    contentBase64: null,
                    rowCount: null,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
                };
            }

            try {
                return await transactionExportService.exportTransactions(user._id, input);
            } catch (error) {
                const code = error.code && ['VALIDATION_ERROR'].includes(error.code)
                    ? error.code
                    : 'INTERNAL_ERROR';

                return {
                    success: false,
                    fileName: null,
                    mimeType: null,
                    contentBase64: null,
                    rowCount: null,
                    error: {
                        code,
                        message: error.message
                    }
                };
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
