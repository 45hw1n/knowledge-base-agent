jest.mock('../../services/transactionListService', () => ({
    listTransactions: jest.fn()
}));

const { listTransactions } = require('../../services/transactionListService');
const { fetchTransactionsByConditions, PAGE_SIZE } = require('../fetchTransactions');

describe('fetchTransactionsByConditions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('fetches all pages until hasNext is false', async () => {
        listTransactions
            .mockResolvedValueOnce({
                data: [{ id: '1', amount: 100 }],
                pagination: { hasNext: true }
            })
            .mockResolvedValueOnce({
                data: [{ id: '2', amount: 200 }],
                pagination: { hasNext: false }
            });

        const conditions = {
            operator: 'AND',
            operands: [{ attribute: 'type', operator: 'is', value: 'DEBIT' }]
        };
        const runtimeContext = { userId: 'user-1' };

        const transactions = await fetchTransactionsByConditions(conditions, runtimeContext);

        expect(transactions).toHaveLength(2);
        expect(listTransactions).toHaveBeenCalledTimes(2);

        expect(listTransactions).toHaveBeenNthCalledWith(
            1,
            {
                listInfo: {
                    conditions,
                    page: 1,
                    pageSize: PAGE_SIZE,
                    sort: [{ attribute: 'date', order: 'ASC' }]
                }
            },
            runtimeContext
        );

        expect(listTransactions).toHaveBeenNthCalledWith(
            2,
            {
                listInfo: {
                    conditions,
                    page: 2,
                    pageSize: PAGE_SIZE,
                    sort: [{ attribute: 'date', order: 'ASC' }]
                }
            },
            runtimeContext
        );
    });

    it('returns empty array when no transactions match', async () => {
        listTransactions.mockResolvedValueOnce({
            data: [],
            pagination: { hasNext: false }
        });

        const transactions = await fetchTransactionsByConditions(null, { userId: 'user-1' });

        expect(transactions).toEqual([]);
        expect(listTransactions).toHaveBeenCalledTimes(1);
    });
});
