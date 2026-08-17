const mongoose = require('mongoose');
const Transaction = require('../../models/Transaction');
const { NOT_DELETED_FILTER } = require('../../utils/transactionQuery.utils');

function parseObjectId(value) {
    if (value == null) return value;
    if (!mongoose.Types.ObjectId.isValid(value)) return value;
    return new mongoose.Types.ObjectId(value);
}

const PAYMENT_MODE_VALUES = [
    'UPI',
    'CARD_PAYMENT',
    'ATM_WITHDRAWAL',
    'NET_BANKING',
    'ONLINE_TRANSACTION'
];
const TYPE_VALUES = ['DEBIT', 'CREDIT'];
const SOURCE_VALUES = ['EMAIL', 'MANUAL', 'IMPORTED'];
const APPROVAL_ACTOR_VALUES = ['AI', 'MANUAL'];
const SHEET_SYNC_STATUS_VALUES = ['PENDING', 'SYNCED', 'FAILED'];

const transactionsListConfig = {
    entityName: 'transactions',
    model: Transaction,
    defaultSort: [{ attribute: 'date', order: 'DESC' }],
    maxPageSize: 100,
    defaultPageSize: 25,
    maxConditionDepth: 8,
    maxPredicates: 50,
    allowDiskUse: false,
    tenantMatchFactory(runtimeContext) {
        return {
            userId: parseObjectId(runtimeContext.userId),
            ...NOT_DELETED_FILTER
        };
    },
    fields: {
        id: {
            field: 'id',
            dbPath: '_id',
            dataType: 'objectId',
            sortable: true,
            filterable: true,
            operators: ['is', 'in'],
            normalizeValue: parseObjectId
        },
        createdAt: {
            field: 'createdAt',
            dbPath: 'createdAt',
            dataType: 'date',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between'],
            normalizeValue: (value) => new Date(value)
        },
        updatedAt: {
            field: 'updatedAt',
            dbPath: 'updatedAt',
            dataType: 'date',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between'],
            normalizeValue: (value) => new Date(value)
        },
        date: {
            field: 'date',
            dbPath: 'date',
            dataType: 'date',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between'],
            normalizeValue: (value) => new Date(value)
        },
        amount: {
            field: 'amount',
            dbPath: 'amount',
            dataType: 'number',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between', 'exists'],
            normalizeValue: (value) => Number(value)
        },
        type: {
            field: 'type',
            dbPath: 'type',
            dataType: 'enum',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn'],
            enumValues: TYPE_VALUES,
            normalizeValue: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value)
        },
        merchant: {
            field: 'merchant',
            dbPath: 'merchantNormalized',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'contains', 'startsWith', 'in'],
            normalizeValue: (value) => (typeof value === 'string' ? value.trim() : value)
        },
        category: {
            field: 'category',
            dbPath: 'category.id',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn', 'exists'],
            normalizeValue: (value) => (typeof value === 'string' ? value.trim() : value)
        },
        subCategory: {
            field: 'subCategory',
            dbPath: 'subCategory.id',
            dataType: 'string',
            sortable: false,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn', 'exists'],
            normalizeValue: (value) => (typeof value === 'string' ? value.trim() : value)
        },
        paymentMode: {
            field: 'paymentMode',
            dbPath: 'paymentMode',
            dataType: 'enum',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn'],
            enumValues: PAYMENT_MODE_VALUES,
            normalizeValue: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value)
        },
        source: {
            field: 'source',
            dbPath: 'source',
            dataType: 'enum',
            sortable: false,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn'],
            enumValues: SOURCE_VALUES,
            normalizeValue: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value)
        },
        cycle: {
            field: 'cycle',
            dbPath: 'cycle',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'in'],
            normalizeValue: (value) => (typeof value === 'string' ? value.trim() : value)
        },
        name: {
            field: 'name',
            dbPath: 'name',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'contains', 'startsWith'],
            normalizeValue: (value) => (typeof value === 'string' ? value.trim() : value)
        },
        isCreditCardRepayment: {
            field: 'isCreditCardRepayment',
            dbPath: 'isCreditCardRepayment',
            dataType: 'boolean',
            sortable: false,
            filterable: true,
            operators: ['is'],
            normalizeValue: (value) => Boolean(value)
        },
        isPrivate: {
            field: 'isPrivate',
            dbPath: 'isPrivate',
            dataType: 'boolean',
            sortable: false,
            filterable: true,
            operators: ['is'],
            normalizeValue: (value) => Boolean(value)
        },
        isEmiInstallment: {
            field: 'isEmiInstallment',
            dbPath: 'isEmiInstallment',
            dataType: 'boolean',
            sortable: false,
            filterable: true,
            operators: ['is'],
            normalizeValue: (value) => Boolean(value)
        },
        isDeleted: {
            field: 'isDeleted',
            dbPath: 'isDeleted',
            dataType: 'boolean',
            sortable: false,
            filterable: true,
            operators: ['is', 'isNot'],
            normalizeValue: (value) => Boolean(value)
        },
        sheetSyncStatus: {
            field: 'sheetSyncStatus',
            dbPath: 'sheetSyncStatus',
            dataType: 'enum',
            sortable: false,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn', 'exists'],
            enumValues: SHEET_SYNC_STATUS_VALUES,
            normalizeValue: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value)
        },
        approvalActor: {
            field: 'approvalActor',
            dbPath: 'approvalActor',
            dataType: 'enum',
            sortable: false,
            filterable: true,
            operators: ['is', 'isNot'],
            enumValues: APPROVAL_ACTOR_VALUES,
            normalizeValue: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value)
        }
    },
    projectStage: {
        _id: 1,
        amount: 1,
        currency: 1,
        type: 1,
        date: 1,
        name: 1,
        merchantNormalized: 1,
        notes: 1,
        category: 1,
        subCategory: 1,
        paymentMode: 1,
        paymentSource: 1,
        source: 1,
        cycle: 1,
        displayId: 1,
        isCreditCardRepayment: 1,
        isPrivate: 1,
        isEmiInstallment: 1,
        approvalActor: 1,
        sheetSyncStatus: 1,
        attachments: 1,
        createdAt: 1,
        updatedAt: 1
    }
};

module.exports = { transactionsListConfig };
