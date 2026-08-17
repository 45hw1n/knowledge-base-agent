/**
 * googleSheetService.js
 *
 * Handles all Google Sheets API operations for syncing transactions.
 * Uses the same OAuth client as gmailService (shared token refresh logic).
 */
const { google } = require('googleapis');
const { getAuthenticatedClient, hasRequiredScopes, SHEETS_REQUIRED_SCOPES } = require('./gmailService');
const UserPreferences = require('../models/UserPreferences');
const Transaction = require('../models/Transaction');
const CreditCard = require('../models/CreditCard');
const BankAccount = require('../models/BankAccount');

/**
 * Sheet column headers (order matters — must match mapTransactionToRow)
 */
const SHEET_HEADERS = [
    'Display ID',
    'Date',
    'Name',
    'Merchant',
    'Amount',
    'Category',
    'Sub Category',
    'Payment Mode',
    'Payment Source',
    'Cycle',
    'Credit Card Repayment',
    'Notes',
];

/**
 * Batch-resolve payment source names for a list of transactions.
 * Groups instrument IDs by model, fetches in two queries max,
 * and returns a Map<instrumentId, name> for O(1) lookup.
 *
 * @param {Object[]} transactions - Array of Transaction documents (plain objects)
 * @returns {Promise<Map<string, string>>} instrumentId → display name
 */
async function resolvePaymentSourceNames(transactions) {
    const nameMap = new Map();

    const ccIds = [];
    const baIds = [];

    for (const txn of transactions) {
        const ps = txn.paymentSource;
        if (!ps?.instrumentId) continue;

        const id = ps.instrumentId.toString();
        if (nameMap.has(id)) continue;

        if (ps.kind === 'CREDIT_CARD') ccIds.push(id);
        else if (ps.kind === 'BANK_ACCOUNT') baIds.push(id);
    }

    const [creditCards, bankAccounts] = await Promise.all([
        ccIds.length > 0
            ? CreditCard.find({ _id: { $in: ccIds } }, { name: 1 }).lean()
            : [],
        baIds.length > 0
            ? BankAccount.find({ _id: { $in: baIds } }, { name: 1 }).lean()
            : [],
    ]);

    for (const cc of creditCards) nameMap.set(cc._id.toString(), cc.name);
    for (const ba of bankAccounts) nameMap.set(ba._id.toString(), ba.name);

    return nameMap;
}

/**
 * Map a Transaction document to a sheet row array.
 * Order must match SHEET_HEADERS.
 *
 * @param {Object} transaction - Transaction document (plain object)
 * @param {string} paymentSourceName - Pre-resolved payment source display name
 * @returns {string[]} Row values
 */
function mapTransactionToRow(transaction, paymentSourceName) {
    const d = new Date(transaction.date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    return [
        transaction.displayId || '',
        formattedDate,
        transaction.name || '',
        transaction.merchant || transaction.merchantNormalized || '',
        transaction.amount,
        transaction.category?.label || 'NA',
        transaction.subCategory?.label || 'NA',
        transaction.paymentMode || 'NA',
        paymentSourceName || 'NA',
        transaction.cycle || 'NA',
        transaction.isCreditCardRepayment ? 'Yes' : 'No',
        transaction.notes || '',
    ];
}

/**
 * Ensure the sheet has the correct headers in the first row.
 * Validates existing headers against SHEET_HEADERS and overwrites if they
 * are missing or stale (idempotent when headers already match).
 *
 * @param {Object} sheets - Authenticated Google Sheets API client
 * @param {string} spreadsheetId - Google Sheet ID
 */
async function ensureSheetHeaders(sheets, spreadsheetId) {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!A1:L1',
    });

    const existingHeaders = response.data.values?.[0];

    const headersMatch = existingHeaders
        && existingHeaders.length === SHEET_HEADERS.length
        && SHEET_HEADERS.every((h, i) => h === existingHeaders[i]);

    if (headersMatch) return;

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:L1',
        valueInputOption: 'RAW',
        requestBody: {
            values: [SHEET_HEADERS],
        },
    });

    console.log('[GoogleSheetService] Headers written to sheet');
}

/**
 * Append a single transaction row to the user's Google Sheet.
 *
 * Flow:
 * 1. Validate user has Sheets scopes
 * 2. Get the sheetId from preferences
 * 3. Get authenticated client (handles token refresh)
 * 4. Ensure headers exist
 * 5. Append the row
 * 6. Update sheetSyncStatus on the Transaction
 *
 * @param {string} userId - MongoDB user ID
 * @param {Object} transaction - Transaction document (plain object)
 * @returns {Object} - { success: boolean, error?: string }
 */
async function appendTransaction(userId, transaction) {
    if (transaction.isPrivate) {
        console.log(`[GoogleSheetService] Skipping private transaction ${transaction.displayId ?? transaction._id}`);
        return { success: true, skipped: true };
    }

    try {
        // 1. Check scopes
        const { hasScopes, missingScopes } = await hasRequiredScopes(userId, SHEETS_REQUIRED_SCOPES);

        if (!hasScopes) {
            const errorMsg = `Insufficient scopes. Missing: ${missingScopes.join(', ')}`;
            console.error(`[GoogleSheetService] ${errorMsg}`);

            await markSyncFailed(userId, transaction._id, errorMsg);
            return { success: false, error: errorMsg };
        }

        // 2. Get sheetId from preferences
        const prefs = await UserPreferences.findOne({ userId }).lean();
        const spreadsheetId = prefs?.googleSheetId;

        if (!spreadsheetId) {
            const errorMsg = 'No Google Sheet ID configured in user preferences';
            console.error(`[GoogleSheetService] ${errorMsg}`);

            await markSyncFailed(userId, transaction._id, errorMsg);
            return { success: false, error: errorMsg };
        }

        // 3. Get authenticated client
        const { client } = await getAuthenticatedClient(userId);
        const sheets = google.sheets({ version: 'v4', auth: client });

        // 4. Ensure headers
        await ensureSheetHeaders(sheets, spreadsheetId);

        // 5. Pre-check: skip write if displayId already exists in the sheet.
        //    Handles the case where a prior run wrote to Sheets but crashed before
        //    updating the DB status — makes this safe to retry unconditionally.
        const existingResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Sheet1!A2:A',
        });
        const existingIds = new Set(
            (existingResponse.data.values || []).flat().filter(Boolean)
        );

        if (existingIds.has(String(transaction.displayId))) {
            console.log(`[GoogleSheetService] Transaction ${transaction.displayId} already in sheet — correcting stale DB status`);
            await markSyncSuccess(userId, transaction._id);
            return { success: true };
        }

        // 6. Resolve payment source name + build row
        const nameMap = await resolvePaymentSourceNames([transaction]);
        const psId = transaction.paymentSource?.instrumentId?.toString();
        const row = mapTransactionToRow(transaction, nameMap.get(psId));

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Sheet1!A:L',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [row],
            },
        });

        console.log(`[GoogleSheetService] Transaction ${transaction.displayId} synced to sheet`);

        // 7. Mark as synced
        await markSyncSuccess(userId, transaction._id);
        return { success: true };

    } catch (error) {
        const errorMsg = error.message || 'Unknown Google Sheets error';
        console.error(`[GoogleSheetService] Sync failed for transaction ${transaction._id}:`, errorMsg);

        await markSyncFailed(userId, transaction._id, errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Batch append multiple transactions to the user's Google Sheet.
 * Uses a single API call for efficiency.
 *
 * @param {string} userId - MongoDB user ID
 * @param {Object[]} transactions - Array of Transaction documents
 * @returns {Object} - { success: boolean, syncedCount: number, error?: string }
 */
async function appendTransactions(userId, transactions) {
    if (!transactions || transactions.length === 0) {
        return { success: true, syncedCount: 0 };
    }

    const syncableTransactions = transactions.filter((t) => !t.isPrivate);
    const skippedPrivateCount = transactions.length - syncableTransactions.length;

    if (skippedPrivateCount > 0) {
        console.log(`[GoogleSheetService] Skipping ${skippedPrivateCount} private transaction(s)`);
    }

    if (syncableTransactions.length === 0) {
        return { success: true, syncedCount: 0 };
    }

    // Declared outside try so the catch block can reference it.
    // Default to full list — narrowed down after the sheet pre-check.
    let newTransactions = syncableTransactions;

    try {
        // 1. Check scopes
        const { hasScopes, missingScopes } = await hasRequiredScopes(userId, SHEETS_REQUIRED_SCOPES);

        if (!hasScopes) {
            const errorMsg = `Insufficient scopes. Missing: ${missingScopes.join(', ')}`;
            await Transaction.updateMany(
                { _id: { $in: syncableTransactions.map(t => t._id) }, userId },
                { sheetSyncStatus: 'FAILED', sheetSyncError: errorMsg }
            );
            return { success: false, syncedCount: 0, error: errorMsg };
        }

        // 2. Get sheetId
        const prefs = await UserPreferences.findOne({ userId }).lean();
        const spreadsheetId = prefs?.googleSheetId;

        if (!spreadsheetId) {
            const errorMsg = 'No Google Sheet ID configured in user preferences';
            await Transaction.updateMany(
                { _id: { $in: syncableTransactions.map(t => t._id) }, userId },
                { sheetSyncStatus: 'FAILED', sheetSyncError: errorMsg }
            );
            return { success: false, syncedCount: 0, error: errorMsg };
        }

        // 3. Auth + sheets client
        const { client } = await getAuthenticatedClient(userId);
        const sheets = google.sheets({ version: 'v4', auth: client });

        // 4. Ensure headers
        await ensureSheetHeaders(sheets, spreadsheetId);

        // 5. Pre-check: read existing displayIds from column A to prevent duplicate rows.
        //    This makes the append idempotent — safe to retry after a partial failure.
        const existingResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Sheet1!A2:A',
        });
        const existingIds = new Set(
            (existingResponse.data.values || []).flat().filter(Boolean)
        );

        // Transactions already in the sheet may still be PENDING in the DB if a previous
        // run crashed after writing to Sheets but before updating the DB. Fix that now.
        const alreadyInSheet = syncableTransactions.filter(t => existingIds.has(String(t.displayId)));
        if (alreadyInSheet.length > 0) {
            console.log(`[GoogleSheetService] ${alreadyInSheet.length} transaction(s) already in sheet — correcting stale DB status`);
            await Transaction.updateMany(
                { _id: { $in: alreadyInSheet.map(t => t._id) }, userId },
                { sheetSyncStatus: 'SYNCED', sheetSyncedAt: new Date(), sheetSyncError: null }
            );
        }

        newTransactions = syncableTransactions.filter(t => !existingIds.has(String(t.displayId)));

        if (newTransactions.length === 0) {
            console.log(`[GoogleSheetService] All ${syncableTransactions.length} transactions already in sheet — nothing to write`);
            return { success: true, syncedCount: 0 };
        }

        // 6. Batch-resolve payment source names + build rows for new transactions only
        const nameMap = await resolvePaymentSourceNames(newTransactions);
        const rows = newTransactions.map(txn => {
            const psId = txn.paymentSource?.instrumentId?.toString();
            return mapTransactionToRow(txn, nameMap.get(psId));
        });

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Sheet1!A:L',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: rows,
            },
        });

        // 7. Single atomic DB update — one round trip instead of N
        await Transaction.updateMany(
            { _id: { $in: newTransactions.map(t => t._id) }, userId },
            { sheetSyncStatus: 'SYNCED', sheetSyncedAt: new Date(), sheetSyncError: null }
        );

        console.log(`[GoogleSheetService] Batch synced ${newTransactions.length} transactions`);
        return { success: true, syncedCount: newTransactions.length };

    } catch (error) {
        const errorMsg = error.message || 'Unknown Google Sheets error';
        console.error(`[GoogleSheetService] Batch sync failed:`, errorMsg);

        await Transaction.updateMany(
            { _id: { $in: newTransactions.map(t => t._id) }, userId },
            { sheetSyncStatus: 'FAILED', sheetSyncError: errorMsg }
        );
        return { success: false, syncedCount: 0, error: errorMsg };
    }
}

/* ─── Internal helpers ─── */

async function markSyncSuccess(userId, transactionId) {
    await Transaction.updateOne(
        { _id: transactionId, userId },
        {
            sheetSyncStatus: 'SYNCED',
            sheetSyncedAt: new Date(),
            sheetSyncError: null,
        }
    );
}

async function markSyncFailed(userId, transactionId, errorMsg) {
    await Transaction.updateOne(
        { _id: transactionId, userId },
        {
            sheetSyncStatus: 'FAILED',
            sheetSyncError: errorMsg,
        }
    );
}

/**
 * Get transactions pending sheet sync for a user.
 * Useful for retry jobs.
 *
 * @param {string} userId
 * @param {number} limit
 * @returns {Object[]} Array of Transaction documents
 */
async function getPendingSheetSync(userId, limit = 50) {
    return Transaction.find({
        userId,
        sheetSyncStatus: 'PENDING',
        isDeleted: { $ne: true },
        isPrivate: { $ne: true }
    })
        .sort({ createdAt: 1 })
        .limit(limit)
        .lean();
}

module.exports = {
    appendTransaction,
    appendTransactions,
    ensureSheetHeaders,
    getPendingSheetSync,
    SHEET_HEADERS,
    mapTransactionToRow,
    resolvePaymentSourceNames,
};
