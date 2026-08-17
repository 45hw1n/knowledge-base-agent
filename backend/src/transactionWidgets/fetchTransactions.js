const { listTransactions } = require('../services/transactionListService');

const PAGE_SIZE = 100;

const DEFAULT_SORT = [{ attribute: 'date', order: 'ASC' }];

/**
 * @param {import('../listing/core/types').ConditionInput | null | undefined} conditions
 * @param {Record<string, unknown>} runtimeContext
 * @param {Array<{ attribute: string, order: string }>} [sort]
 * @returns {Promise<import('./types').NormalizedTransaction[]>}
 */
async function fetchTransactionsByConditions(conditions, runtimeContext, sort = DEFAULT_SORT) {
    let page = 1;
    const transactions = [];

    while (true) {
        const result = await listTransactions(
            {
                listInfo: {
                    conditions,
                    page,
                    pageSize: PAGE_SIZE,
                    sort
                }
            },
            runtimeContext
        );

        transactions.push(...result.data);

        if (!result.pagination.hasNext) {
            break;
        }

        page += 1;
    }

    return transactions;
}

module.exports = {
    fetchTransactionsByConditions,
    PAGE_SIZE,
    DEFAULT_SORT
};
