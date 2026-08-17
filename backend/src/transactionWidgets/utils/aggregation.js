/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} keyFn
 * @returns {Map<string, T[]>}
 */
function groupBy(items, keyFn) {
    const map = new Map();

    for (const item of items) {
        const key = keyFn(item);
        const bucket = map.get(key);

        if (bucket) {
            bucket.push(item);
        } else {
            map.set(key, [item]);
        }
    }

    return map;
}

/**
 * @param {Array<{ amount?: number }>} items
 * @returns {number}
 */
function sumAmounts(items) {
    return items.reduce((sum, item) => {
        const amount = item?.amount;
        return sum + (typeof amount === 'number' && Number.isFinite(amount) ? amount : 0);
    }, 0);
}

/**
 * @param {number} part
 * @param {number} total
 * @returns {number}
 */
function calculatePercent(part, total) {
    if (total <= 0) {
        return 0;
    }

    return Math.round((part / total) * 10000) / 100;
}

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number} amountFn
 * @returns {T[]}
 */
function sortByAmountDesc(items, amountFn) {
    return [...items].sort((left, right) => amountFn(right) - amountFn(left));
}

module.exports = {
    groupBy,
    sumAmounts,
    calculatePercent,
    sortByAmountDesc
};
