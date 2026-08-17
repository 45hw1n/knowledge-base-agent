const { validateListRequest } = require('../validation');
const { ListValidationError } = require('../errors');

const config = {
    defaultSort: [{ attribute: 'createdAt', order: 'DESC' }],
    fields: {
        createdAt: {
            field: 'createdAt',
            dbPath: 'createdAt',
            sortable: true,
            filterable: true,
            operators: ['is', 'gt', 'lt']
        },
        status: {
            field: 'status',
            dbPath: 'status',
            sortable: true,
            filterable: true,
            operators: ['is', 'in']
        }
    },
    maxPageSize: 100,
    maxConditionDepth: 3,
    maxPredicates: 5
};

describe('validateListRequest', () => {
    it('normalizes defaults and condition operator casing', () => {
        const request = {
            sort: [{ attribute: 'createdAt', order: 'desc' }],
            conditions: {
                operator: 'and',
                operands: [
                    { attribute: 'status', operator: 'IS', value: 'OPEN' }
                ]
            }
        };

        const result = validateListRequest(request, config);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(25);
        expect(result.sort).toEqual([{ attribute: 'createdAt', order: 'DESC' }]);
        expect(result.conditions.operator).toBe('AND');
        expect(result.conditions.operands[0].operator).toBe('is');
    });

    it('rejects unsupported fields', () => {
        expect(() =>
            validateListRequest(
                {
                    conditions: {
                        attribute: 'unknownField',
                        operator: 'is',
                        value: 1
                    }
                },
                config
            )
        ).toThrow(ListValidationError);
    });

    it('rejects condition tree depth violations', () => {
        const deepConditions = {
            operator: 'AND',
            operands: [
                {
                    operator: 'AND',
                    operands: [
                        {
                            operator: 'AND',
                            operands: [{ attribute: 'status', operator: 'is', value: 'OPEN' }]
                        }
                    ]
                }
            ]
        };

        expect(() => validateListRequest({ conditions: deepConditions }, config)).toThrow(
            ListValidationError
        );
    });
});

