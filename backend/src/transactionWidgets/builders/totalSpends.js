const { sumAmounts } = require('../utils/aggregation');

/**
 * @param {import('../types').NormalizedTransaction[]} transactions
 * @returns {import('../types').TotalSpendsWidget}
 */
function buildTotalSpends(transactions) {
    return {
        amount: sumAmounts(transactions),
        transactionCount: transactions.length
    };
}

module.exports = { buildTotalSpends };
