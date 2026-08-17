const { buildConditionAst } = require('../ast');
const { MongoConditionTranslator } = require('../translator');
const { createDefaultOperatorRegistry } = require('../operatorRegistry');
const { buildAggregationPipeline } = require('../pipelineBuilder');

const fields = {
    status: {
        field: 'status',
        dbPath: 'status',
        sortable: true,
        filterable: true,
        operators: ['is']
    },
    priority: {
        field: 'priority',
        dbPath: 'priority',
        sortable: true,
        filterable: true,
        operators: ['is']
    },
    createdAt: {
        field: 'createdAt',
        dbPath: 'createdAt',
        sortable: true,
        filterable: true,
        operators: ['is']
    }
};

describe('translator and pipeline builder', () => {
    it('translates nested AND/OR conditions', () => {
        const ast = buildConditionAst({
            operator: 'AND',
            operands: [
                { attribute: 'status', operator: 'is', value: 'OPEN' },
                {
                    operator: 'OR',
                    operands: [
                        { attribute: 'priority', operator: 'is', value: 'HIGH' },
                        { attribute: 'priority', operator: 'is', value: 'MEDIUM' }
                    ]
                }
            ]
        });

        const translator = new MongoConditionTranslator({
            fields,
            operatorRegistry: createDefaultOperatorRegistry()
        });

        expect(translator.translate(ast)).toEqual({
            $and: [
                { status: { $eq: 'OPEN' } },
                { $or: [{ priority: { $eq: 'HIGH' } }, { priority: { $eq: 'MEDIUM' } }] }
            ]
        });
    });

    it('builds facet pagination pipeline', () => {
        const pipeline = buildAggregationPipeline({
            baseStages: [],
            tenantMatch: { userId: 'u1' },
            translatedMatch: { status: { $eq: 'OPEN' } },
            listInfo: {
                page: 1,
                pageSize: 25,
                sort: [{ attribute: 'createdAt', order: 'DESC' }]
            },
            config: {
                fields,
                projectStage: { _id: 1, status: 1 }
            }
        });

        expect(pipeline[0]).toEqual({ $match: { userId: 'u1' } });
        expect(pipeline[1]).toEqual({ $match: { status: { $eq: 'OPEN' } } });
        expect(pipeline[2].$facet).toBeDefined();
        expect(pipeline[2].$facet.data).toEqual([
            { $sort: { createdAt: -1, _id: 1 } },
            { $skip: 0 },
            { $limit: 25 },
            { $project: { _id: 1, status: 1 } }
        ]);
        expect(pipeline[2].$facet.totalCount).toEqual([{ $count: 'total' }]);
    });
});

