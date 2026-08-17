const {
    groupBy,
    sumAmounts,
    calculatePercent,
    sortByAmountDesc
} = require('../utils/aggregation');

describe('aggregation utils', () => {
    describe('groupBy', () => {
        it('groups items by key function', () => {
            const items = [
                { category: 'FOOD', amount: 100 },
                { category: 'FOOD', amount: 50 },
                { category: 'TRAVEL', amount: 200 }
            ];

            const grouped = groupBy(items, (item) => item.category);

            expect(grouped.get('FOOD')).toHaveLength(2);
            expect(grouped.get('TRAVEL')).toHaveLength(1);
        });

        it('returns empty map for empty input', () => {
            const grouped = groupBy([], (item) => item.category);
            expect(grouped.size).toBe(0);
        });
    });

    describe('sumAmounts', () => {
        it('sums valid amounts', () => {
            expect(sumAmounts([{ amount: 10 }, { amount: 20.5 }])).toBe(30.5);
        });

        it('treats invalid amounts as zero', () => {
            expect(sumAmounts([{ amount: 10 }, { amount: null }, { amount: 'bad' }])).toBe(10);
        });

        it('returns zero for empty input', () => {
            expect(sumAmounts([])).toBe(0);
        });
    });

    describe('calculatePercent', () => {
        it('calculates percent rounded to two decimals', () => {
            expect(calculatePercent(25, 200)).toBe(12.5);
            expect(calculatePercent(1, 3)).toBe(33.33);
        });

        it('returns zero when total is zero or negative', () => {
            expect(calculatePercent(10, 0)).toBe(0);
            expect(calculatePercent(10, -5)).toBe(0);
        });
    });

    describe('sortByAmountDesc', () => {
        it('sorts items by amount descending', () => {
            const items = [
                { name: 'b', amount: 50 },
                { name: 'a', amount: 100 },
                { name: 'c', amount: 75 }
            ];

            const sorted = sortByAmountDesc(items, (item) => item.amount);

            expect(sorted.map((item) => item.name)).toEqual(['a', 'c', 'b']);
        });
    });
});
