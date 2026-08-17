const { buildTotalSpends } = require('../builders/totalSpends');
const { buildSpendByCategory } = require('../builders/spendByCategory');
const { buildCreditCardSpends } = require('../builders/creditCardSpends');
const { buildTopMerchants } = require('../builders/topMerchants');
const { buildPaymentModes } = require('../builders/paymentModes');
const { buildTrend } = require('../builders/trend');

const sampleTransactions = [
    {
        id: '1',
        amount: 100,
        date: '2026-06-01T10:00:00.000Z',
        merchant: 'Amazon',
        category: { id: '1', value: 'SHOPPING', label: 'Shopping' },
        paymentMode: 'CREDIT_CARD',
        paymentSource: {
            kind: 'CREDIT_CARD',
            instrumentId: 'cc1',
            displayName: 'HDFC Regalia',
            last4: '1234',
            bank: 'HDFC'
        }
    },
    {
        id: '2',
        amount: 50,
        date: '2026-06-01T18:00:00.000Z',
        merchant: 'Swiggy',
        category: { id: '2', value: 'DINING', label: 'Dining' },
        paymentMode: 'UPI',
        paymentSource: {
            kind: 'BANK_ACCOUNT',
            instrumentId: 'ba1',
            displayName: 'HDFC Savings',
            last4: '5678',
            bank: 'HDFC'
        }
    },
    {
        id: '3',
        amount: 200,
        date: '2026-06-02T09:00:00.000Z',
        merchant: 'Amazon',
        category: { id: '1', value: 'SHOPPING', label: 'Shopping' },
        paymentMode: 'CREDIT_CARD',
        paymentSource: {
            kind: 'CREDIT_CARD',
            instrumentId: 'cc2',
            displayName: 'ICICI Amazon Pay',
            last4: '9999',
            bank: 'ICICI'
        }
    },
    {
        id: '4',
        amount: 75,
        date: '2026-06-03T12:00:00.000Z',
        merchant: '',
        category: null,
        paymentMode: 'DEBIT_CARD',
        paymentSource: null
    }
];

describe('widget builders', () => {
    it('buildTotalSpends sums amounts and counts transactions', () => {
        expect(buildTotalSpends(sampleTransactions)).toEqual({
            amount: 425,
            transactionCount: 4
        });

        expect(buildTotalSpends([])).toEqual({
            amount: 0,
            transactionCount: 0
        });
    });

    it('buildSpendByCategory groups by category value with percents', () => {
        const result = buildSpendByCategory(sampleTransactions);

        expect(result.total).toBe(425);
        expect(result.categories).toEqual([
            {
                category: 'SHOPPING',
                amount: 300,
                percent: 70.59,
                transactionCount: 2
            },
            {
                category: 'UNKNOWN',
                amount: 75,
                percent: 17.65,
                transactionCount: 1
            },
            {
                category: 'DINING',
                amount: 50,
                percent: 11.76,
                transactionCount: 1
            }
        ]);
    });

    it('buildCreditCardSpends filters and groups validated credit card transactions', () => {
        const creditCardMap = new Map([
            ['cc1', { name: 'HDFC Regalia', last4: '1234', bank: 'HDFC' }],
            ['cc2', { name: 'ICICI Amazon Pay', last4: '9999', bank: 'ICICI' }]
        ]);

        const result = buildCreditCardSpends(sampleTransactions, {
            validCreditCardIds: new Set(['cc1', 'cc2']),
            creditCardMap
        });

        expect(result.total).toBe(300);
        expect(result.cards).toEqual([
            {
                name: 'ICICI Amazon Pay',
                amount: 200,
                percent: 66.67
            },
            {
                name: 'HDFC Regalia',
                amount: 100,
                percent: 33.33
            }
        ]);
    });

    it('buildCreditCardSpends excludes transactions without a valid credit card in the database', () => {
        const result = buildCreditCardSpends(sampleTransactions, {
            validCreditCardIds: new Set(['cc1']),
            creditCardMap: new Map([
                ['cc1', { name: 'HDFC Regalia', last4: '1234', bank: 'HDFC' }]
            ])
        });

        expect(result.total).toBe(100);
        expect(result.cards).toEqual([
            {
                name: 'HDFC Regalia',
                amount: 100,
                percent: 100
            }
        ]);
    });

    it('buildCreditCardSpends ignores paymentMode when paymentSource is not a valid credit card', () => {
        const transactions = [
            {
                id: '1',
                amount: 100,
                date: '2026-06-01T10:00:00.000Z',
                merchant: 'Amazon',
                category: null,
                paymentMode: 'CREDIT_CARD',
                paymentSource: {
                    kind: 'BANK_ACCOUNT',
                    instrumentId: 'ba1',
                    displayName: 'HDFC Savings',
                    last4: '5678',
                    bank: 'HDFC'
                }
            }
        ];

        const result = buildCreditCardSpends(transactions, {
            validCreditCardIds: new Set(['ba1']),
            creditCardMap: new Map()
        });

        expect(result).toEqual({ total: 0, cards: [] });
    });

    it('buildTopMerchants ranks merchants and respects limit', () => {
        const result = buildTopMerchants(sampleTransactions, { limit: 2 });

        expect(result.total).toBe(425);
        expect(result.merchants).toHaveLength(2);
        expect(result.merchants[0]).toEqual({
            merchant: 'Amazon',
            amount: 300,
            percent: 70.59,
            transactionCount: 2
        });
        expect(result.merchants[1].merchant).toBe('Unknown');
    });

    it('buildPaymentModes groups by payment mode', () => {
        const result = buildPaymentModes(sampleTransactions);

        expect(result.total).toBe(425);
        expect(result.modes).toEqual([
            {
                mode: 'CREDIT_CARD',
                amount: 300,
                percent: 70.59,
                transactionCount: 2
            },
            {
                mode: 'DEBIT_CARD',
                amount: 75,
                percent: 17.65,
                transactionCount: 1
            },
            {
                mode: 'UPI',
                amount: 50,
                percent: 11.76,
                transactionCount: 1
            }
        ]);
    });

    it('buildTrend groups by UTC date and sorts ascending', () => {
        const result = buildTrend(sampleTransactions);

        expect(result.total).toBe(425);
        expect(result.points).toEqual([
            { date: '2026-06-01', amount: 150 },
            { date: '2026-06-02', amount: 200 },
            { date: '2026-06-03', amount: 75 }
        ]);
    });
});
