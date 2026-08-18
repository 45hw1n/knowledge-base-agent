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
    defaultSort: [{ attribute: 'extractedAt', order: 'DESC' }],
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
        entityType: {
            field: 'entityType',
            dbPath: 'entityType',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn', 'contains', 'startsWith']
        },
        status: {
            field: 'status',
            dbPath: 'status',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn']
        },
        sourceType: {
            field: 'sourceType',
            dbPath: 'sourceType',
            dataType: 'string',
            sortable: true,
            filterable: true,
            operators: ['is', 'isNot', 'in', 'notIn']
        },
        sourceEmailId: {
            field: 'sourceEmailId',
            dbPath: 'sourceEmailId',
            dataType: 'objectId',
            sortable: false,
            filterable: true,
            operators: ['is', 'in'],
            normalizeValue: parseObjectId
        },
        confidence: {
            field: 'confidence',
            dbPath: 'confidence',
            dataType: 'number',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'gte', 'lt', 'lte', 'between']
        },
        extractedAt: {
            field: 'extractedAt',
            dbPath: 'extractedAt',
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
        // `data` (the extracted fields) is intentionally not filterable/sortable
        // here — it's schemaless per entityType. Returned as opaque JSON.
    }
};

module.exports = { entitiesListConfig };
