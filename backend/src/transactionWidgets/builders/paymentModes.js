const { groupBy, sumAmounts, calculatePercent, sortByAmountDesc } = require('../utils/aggregation');

/**
 * @param {import('../types').NormalizedTransaction[]} transactions
 * @returns {import('../types').PaymentModesWidget}
 */
function buildPaymentModes(transactions) {
    const total = sumAmounts(transactions);
    const grouped = groupBy(transactions, (transaction) => transaction.paymentMode || 'UNKNOWN');

    const modes = sortByAmountDesc(
        Array.from(grouped.entries()).map(([mode, items]) => {
            const amount = sumAmounts(items);

            return {
                mode,
                amount,
                percent: calculatePercent(amount, total),
                transactionCount: items.length
            };
        }),
        (item) => item.amount
    );

    return { total, modes };
}

module.exports = { buildPaymentModes };
