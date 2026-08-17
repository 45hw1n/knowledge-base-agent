const mongoose = require('mongoose');
const TransactionsToReview = require('../../models/TransactionsToReview');

function parseObjectId(value) {
    if (value == null) return value;
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return value;
    }
    return new mongoose.Types.ObjectId(value);
}

const STATUS_VALUES = ['READY_TO_REVIEW', 'APPROVED', 'AUTO_APPROVED', 'REJECTED'];
const PAYMENT_MODE_VALUES = [
    'UPI',
    'CARD_PAYMENT',
    'ATM_WITHDRAWAL',
    'NET_BANKING',
    'ONLINE_TRANSACTION'
];
const TYPE_VALUES = ['DEBIT', 'CREDIT'];

const transactionsToReviewListConfig = {
    entityName: 'transactionsToReview',
    model: TransactionsToReview,
    defaultSort: [{ attribute: 'createdAt', order: 'DESC' }],
    maxPageSize: 100,
    defaultPageSize: 25,
    maxConditionDepth: 8,
    maxPredicates: 50,
    allowDiskUse: false,
    tenantMatchFactory(runtimeContext) {
        return {
            userId: parseObjectId(runtimeContext.userId)
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
        status: {
            field: 'status',
            dbPath: 'status',
            dataType: 'enum',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn'],
            enumValues: STATUS_VALUES,
            normalizeValue: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value)
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
        date: {
            field: 'date',
            dbPath: 'date',
            dataType: 'date',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between'],
            normalizeValue: (value) => new Date(value)
        }
    },
    projectStage: {
        _id: 1,
        amount: 1,
        currency: 1,
        status: 1,
        merchantNormalized: 1,
        merchantRaw: 1,
        name: 1,
        category: 1,
        subCategory: 1,
        paymentMode: 1,
        paymentSource: 1,
        type: 1,
        date: 1,
        cycle: 1,
        notes: 1,
        referenceId: 1,
        'LLMMeta.confidence.overall': 1,
        'userApprovedData.isPrivate': 1,
        attachments: 1,
        createdAt: 1,
        updatedAt: 1
    }
};

module.exports = {
    transactionsToReviewListConfig
};
