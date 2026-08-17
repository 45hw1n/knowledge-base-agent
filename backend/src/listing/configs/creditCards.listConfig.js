const mongoose = require('mongoose');
const CreditCard = require('../../models/CreditCard');

function parseObjectId(value) {
    if (value == null) return value;
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return value;
    }
    return new mongoose.Types.ObjectId(value);
}

const creditCardsListConfig = {
    entityName: 'creditCards',
    model: CreditCard,
    defaultSort: [{ attribute: 'createdAt', order: 'DESC' }],
    maxPageSize: 100,
    defaultPageSize: 25,
    maxConditionDepth: 8,
    maxPredicates: 50,
    allowDiskUse: false,
    tenantMatchFactory(runtimeContext) {
        return {
            userId: parseObjectId(runtimeContext.userId),
            isActive: true
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
        name: {
            field: 'name',
            dbPath: 'name',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'contains', 'startsWith', 'in'],
            normalizeValue: (value) => (typeof value === 'string' ? value.trim() : value)
        },
        bank: {
            field: 'bank',
            dbPath: 'bank',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'contains', 'startsWith', 'in'],
            normalizeValue: (value) => (typeof value === 'string' ? value.trim() : value)
        },
        last4: {
            field: 'last4',
            dbPath: 'last4',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in']
        },
        network: {
            field: 'network',
            dbPath: 'network',
            dataType: 'enum',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in'],
            enumValues: ['VISA', 'MASTERCARD', 'RUPAY', 'AMEX'],
            normalizeValue: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value)
        },
        expiryMonth: {
            field: 'expiryMonth',
            dbPath: 'expiryMonth',
            dataType: 'number',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between'],
            normalizeValue: (value) => Number(value)
        },
        expiryYear: {
            field: 'expiryYear',
            dbPath: 'expiryYear',
            dataType: 'number',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between'],
            normalizeValue: (value) => Number(value)
        },
        billingCycleDay: {
            field: 'billingCycleDay',
            dbPath: 'billingCycleDay',
            dataType: 'number',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between'],
            normalizeValue: (value) => Number(value)
        },
        dueDateDay: {
            field: 'dueDateDay',
            dbPath: 'dueDateDay',
            dataType: 'number',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between'],
            normalizeValue: (value) => Number(value)
        },
        creditLimit: {
            field: 'creditLimit',
            dbPath: 'creditLimit',
            dataType: 'number',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between', 'exists'],
            normalizeValue: (value) => Number(value)
        },
        isActive: {
            field: 'isActive',
            dbPath: 'isActive',
            dataType: 'boolean',
            sortable: true,
            filterable: true,
            operators: ['is', 'exists'],
            normalizeValue: (value) => Boolean(value)
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
        }
    },
    projectStage: {
        _id: 1,
        name: 1,
        bank: 1,
        last4: 1,
        expiryMonth: 1,
        expiryYear: 1,
        network: 1,
        billingCycleDay: 1,
        dueDateDay: 1,
        creditLimit: 1,
        linkedBankAccountId: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1
    }
};

module.exports = {
    creditCardsListConfig
};

