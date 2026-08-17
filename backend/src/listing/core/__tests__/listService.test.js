const { createListService } = require('../listService');

function createMockModel(facetPayload) {
    return {
        aggregate: jest.fn(() => ({
            allowDiskUse: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([facetPayload])
        }))
    };
}

describe('createListService', () => {
    it('returns normalized listInfo and pagination meta', async () => {
        const model = createMockModel({
            data: [{ _id: '1', name: 'Card A' }],
            totalCount: [{ total: 230 }]
        });

        const service = createListService({
            model,
            defaultSort: [{ attribute: 'createdAt', order: 'DESC' }],
            fields: {
                createdAt: {
                    field: 'createdAt',
                    dbPath: 'createdAt',
                    sortable: true,
                    filterable: true,
                    operators: ['is']
                },
                status: {
                    field: 'status',
                    dbPath: 'status',
                    sortable: true,
                    filterable: true,
                    operators: ['is']
                }
            },
            tenantMatchFactory: ({ userId }) => ({ userId }),
            projectStage: { _id: 1, name: 1 }
        });

        const response = await service.list(
            {
                page: 1,
                pageSize: 25,
                sort: [{ attribute: 'createdAt', order: 'DESC' }],
                conditions: {
                    attribute: 'status',
                    operator: 'is',
                    value: 'OPEN'
                }
            },
            { userId: 'u1' }
        );

        expect(response.listInfo).toEqual({
            page: 1,
            pageSize: 25,
            sort: [{ attribute: 'createdAt', order: 'DESC' }],
            conditions: { attribute: 'status', operator: 'is', value: 'OPEN' }
        });
        expect(response.pagination).toEqual({
            total: 230,
            totalPages: 10,
            hasNext: true,
            hasPrevious: false
        });
        expect(response.meta.cached).toBe(false);
        expect(Array.isArray(response.data)).toBe(true);
        expect(model.aggregate).toHaveBeenCalled();
    });
});

