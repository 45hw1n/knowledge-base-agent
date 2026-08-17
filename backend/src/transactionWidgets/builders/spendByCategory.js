const { groupBy, sumAmounts, calculatePercent, sortByAmountDesc } = require('../utils/aggregation');

/**
 * @param {import('../types').NormalizedTransaction[]} transactions
 * @returns {import('../types').SpendByCategoryWidget}
 */
function buildSpendByCategory(transactions) {
    const total = sumAmounts(transactions);
    const grouped = groupBy(transactions, (transaction) => transaction.category?.value ?? 'UNKNOWN');

    const categories = sortByAmountDesc(
        Array.from(grouped.entries()).map(([category, items]) => {
            const amount = sumAmounts(items);

            return {
                category,
                amount,
                percent: calculatePercent(amount, total),
                transactionCount: items.length
            };
        }),
        (item) => item.amount
    );

    return { total, categories };
}

module.exports = { buildSpendByCategory };
