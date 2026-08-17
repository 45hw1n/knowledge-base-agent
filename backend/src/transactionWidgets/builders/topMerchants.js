const { groupBy, sumAmounts, calculatePercent, sortByAmountDesc } = require('../utils/aggregation');

const DEFAULT_LIMIT = 5;

/**
 * @param {import('../types').NormalizedTransaction[]} transactions
 * @param {{ limit?: number } | undefined} config
 * @returns {import('../types').TopMerchantsWidget}
 */
function buildTopMerchants(transactions, config) {
    const limit =
        typeof config?.limit === 'number' && Number.isFinite(config.limit) && config.limit > 0
            ? Math.floor(config.limit)
            : DEFAULT_LIMIT;

    const total = sumAmounts(transactions);
    const grouped = groupBy(transactions, (transaction) => transaction.merchant || 'Unknown');

    const merchants = sortByAmountDesc(
        Array.from(grouped.entries()).map(([merchant, items]) => {
            const amount = sumAmounts(items);

            return {
                merchant,
                amount,
                percent: calculatePercent(amount, total),
                transactionCount: items.length
            };
        }),
        (item) => item.amount
    ).slice(0, limit);

    return { total, merchants };
}

module.exports = { buildTopMerchants };
