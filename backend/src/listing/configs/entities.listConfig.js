const mongoose = require('mongoose');
const Entity = require('../../models/Entity');

function parseObjectId(value) {
    if (value == null) return value;
    if (!mongoose.Types.ObjectId.isValid(value)) return value;
    return new mongoose.Types.ObjectId(value);
}

const entitiesListConfig = {
    entityName: 'entities',
    model: Entity,
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
        type: {
            field: 'type',
            dbPath: 'type',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn']
        },
        displayId: {
            field: 'displayId',
            dbPath: 'displayId',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn', 'contains', 'startsWith']
        },
        title: {
            field: 'title',
            dbPath: 'title',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'contains', 'startsWith']
        },
        sourceType: {
            field: 'sourceType',
            dbPath: 'source.type',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn']
        },
        extractionStatus: {
            field: 'extractionStatus',
            dbPath: 'extraction.status',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn']
        },
        extractionConfidence: {
            field: 'extractionConfidence',
            dbPath: 'extraction.confidence',
            dataType: 'number',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between']
        },
        extractedAt: {
            field: 'extractedAt',
            dbPath: 'extraction.extractedAt',
            dataType: 'date',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between'],
            normalizeValue: (value) => new Date(value)
        },
        createdAt: {
            field: 'createdAt',
            dbPath: 'createdAt',
            dataType: 'date',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between'],
            normalizeValue: (value) => new Date(value)
        }
    }
};

module.exports = { entitiesListConfig };
