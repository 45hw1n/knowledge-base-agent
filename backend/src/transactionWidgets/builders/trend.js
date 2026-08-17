const { groupBy, sumAmounts } = require('../utils/aggregation');

/**
 * @param {string | null | undefined} dateValue
 * @returns {string}
 */
function toDateKey(dateValue) {
    if (!dateValue) {
        return 'UNKNOWN';
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return 'UNKNOWN';
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * @param {import('../types').NormalizedTransaction[]} transactions
 * @returns {import('../types').TrendWidget}
 */
function buildTrend(transactions) {
    const total = sumAmounts(transactions);
    const grouped = groupBy(transactions, (transaction) => toDateKey(transaction.date));

    const points = Array.from(grouped.entries())
        .filter(([date]) => date !== 'UNKNOWN')
        .map(([date, items]) => ({
            date,
            amount: sumAmounts(items)
        }))
        .sort((left, right) => left.date.localeCompare(right.date));

    return { total, points };
}

module.exports = { buildTrend };
