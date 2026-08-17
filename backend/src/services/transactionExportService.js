const ExcelJS = require('exceljs');
const { fetchTransactionsByConditions } = require('../transactionWidgets/fetchTransactions');
const {
    SHEET_HEADERS,
    mapTransactionToRow,
} = require('./googleSheetService');

const MAX_EXPORT_ROWS = 10000;
const DEFAULT_EXPORT_SORT = [{ attribute: 'date', order: 'DESC' }];
const EXPORT_TYPES = new Set(['CSV', 'XLSX']);

const MIME_TYPES = {
    CSV: 'text/csv;charset=utf-8',
    XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const PRIVATE_COLUMN_HEADER = 'Private';

function escapeCsvCell(value) {
    const str = value == null ? '' : String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function buildCsvContent(headers, rows) {
    const lines = [
        headers.map(escapeCsvCell).join(','),
        ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ];
    return lines.join('\n');
}

async function buildXlsxBuffer(headers, rows) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transactions');
    sheet.addRow(headers);
    for (const row of rows) {
        sheet.addRow(row);
    }
    return workbook.xlsx.writeBuffer();
}

function getPaymentSourceName(transaction) {
    return transaction.paymentSource?.displayName || null;
}

function includesPrivateTransactions(conditions) {
    return !hasIsPrivateExclusionFilter(conditions);
}

function hasIsPrivateExclusionFilter(conditions) {
    if (!conditions || typeof conditions !== 'object') {
        return false;
    }

    if (
        conditions.attribute === 'isPrivate'
        && conditions.operator === 'is'
        && conditions.value === false
    ) {
        return true;
    }

    if (Array.isArray(conditions.operands)) {
        for (const operand of conditions.operands) {
            if (hasIsPrivateExclusionFilter(operand)) return true;
        }
    }

    return false;
}

function buildExportHeaders(includePrivateColumn) {
    if (!includePrivateColumn) return SHEET_HEADERS;
    return [...SHEET_HEADERS, PRIVATE_COLUMN_HEADER];
}

function mapTransactionToExportRow(transaction, paymentSourceName, includePrivateColumn) {
    const row = mapTransactionToRow(transaction, paymentSourceName);
    if (!includePrivateColumn) return row;
    return [...row, transaction.isPrivate ?? false];
}

function mapTransactionsToRows(transactions, includePrivateColumn = false) {
    return transactions.map((transaction) =>
        mapTransactionToExportRow(
            transaction,
            getPaymentSourceName(transaction),
            includePrivateColumn
        )
    );
}

function findPeriodLabel(conditions) {
    if (!conditions || typeof conditions !== 'object') {
        return null;
    }

    if (conditions.attribute === 'cycle' && conditions.operator === 'is' && conditions.value) {
        return String(conditions.value);
    }

    if (
        conditions.attribute === 'date'
        && conditions.operator === 'between'
        && Array.isArray(conditions.value)
        && conditions.value[0]
    ) {
        const start = new Date(conditions.value[0]);
        if (!Number.isNaN(start.getTime())) {
            const month = String(start.getUTCMonth() + 1).padStart(2, '0');
            const year = start.getUTCFullYear();
            return `${month}-${year}`;
        }
    }

    if (Array.isArray(conditions.operands)) {
        for (const operand of conditions.operands) {
            const label = findPeriodLabel(operand);
            if (label) return label;
        }
    }

    return null;
}

function buildExportFileName(exportType, conditions, includePrivateTransactions) {
    const periodLabel = findPeriodLabel(conditions);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const suffix = periodLabel ?? dateStamp;
    const privateSuffix = includePrivateTransactions ? '-private' : '';
    const extension = exportType === 'XLSX' ? 'xlsx' : 'csv';
    return `transactions-${suffix}${privateSuffix}.${extension}`;
}

function createValidationError(message) {
    const error = new Error(message);
    error.code = 'VALIDATION_ERROR';
    return error;
}

/**
 * @param {string} userId
 * @param {{ exportType: string, sort?: Array<{ attribute: string, order: string }>, conditions: object }} input
 */
async function exportTransactions(userId, input) {
    const exportType = input?.exportType;
    if (!EXPORT_TYPES.has(exportType)) {
        throw createValidationError('Invalid export type. Supported types: CSV, XLSX');
    }

    if (!input?.conditions) {
        throw createValidationError('Export conditions are required');
    }

    const sort = input.sort?.length ? input.sort : DEFAULT_EXPORT_SORT;
    const transactions = await fetchTransactionsByConditions(
        input.conditions,
        { userId },
        sort
    );

    if (transactions.length === 0) {
        throw createValidationError('No transactions to export');
    }

    if (transactions.length > MAX_EXPORT_ROWS) {
        throw createValidationError(
            `Export exceeds the maximum of ${MAX_EXPORT_ROWS} transactions`
        );
    }

    const includePrivateTransactions = includesPrivateTransactions(input.conditions);
    const rows = mapTransactionsToRows(transactions, includePrivateTransactions);
    const headers = buildExportHeaders(includePrivateTransactions);
    const fileName = buildExportFileName(
        exportType,
        input.conditions,
        includePrivateTransactions
    );

    let buffer;
    if (exportType === 'CSV') {
        const csv = buildCsvContent(headers, rows);
        buffer = Buffer.from(csv, 'utf-8');
    } else {
        buffer = Buffer.from(await buildXlsxBuffer(headers, rows));
    }

    return {
        success: true,
        fileName,
        mimeType: MIME_TYPES[exportType],
        contentBase64: buffer.toString('base64'),
        rowCount: transactions.length,
        error: null,
    };
}

module.exports = {
    exportTransactions,
    MAX_EXPORT_ROWS,
};
