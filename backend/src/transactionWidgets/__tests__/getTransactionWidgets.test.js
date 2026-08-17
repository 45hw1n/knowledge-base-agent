jest.mock('../fetchTransactions', () => ({
    fetchTransactionsByConditions: jest.fn()
}));

jest.mock('../resolveValidCreditCards', () => ({
    resolveValidCreditCards: jest.fn()
}));

const { fetchTransactionsByConditions } = require('../fetchTransactions');
const { resolveValidCreditCards } = require('../resolveValidCreditCards');
const { getTransactionWidgets } = require('../getTransactionWidgets');

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
        date: '2026-06-02T10:00:00.000Z',
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
    }
];

describe('getTransactionWidgets', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fetchTransactionsByConditions.mockResolvedValue(sampleTransactions);
        resolveValidCreditCards.mockResolvedValue({
            validCreditCardIds: new Set(),
            creditCardMap: new Map()
        });
    });

    it('returns only requested widgets', async () => {
        const input = {
            conditions: {
                operator: 'AND',
                operands: [{ attribute: 'type', operator: 'is', value: 'DEBIT' }]
            },
            widgets: [{ type: 'TOTAL_SPENDS' }, { type: 'TREND' }]
        };

        const result = await getTransactionWidgets(input, { userId: 'user-1' });

        expect(fetchTransactionsByConditions).toHaveBeenCalledWith(input.conditions, {
            userId: 'user-1'
        });
        expect(result.data.widgets).toEqual({
            TOTAL_SPENDS: {
                amount: 150,
                transactionCount: 2
            },
            TREND: {
                total: 150,
                points: [
                    { date: '2026-06-01', amount: 100 },
                    { date: '2026-06-02', amount: 50 }
                ]
            }
        });
        expect(result.data.widgets.SPEND_BY_CATEGORY).toBeUndefined();
    });

    it('validates input before fetching transactions', async () => {
        await expect(getTransactionWidgets({ conditions: null, widgets: [] }, {})).rejects.toThrow(
            'conditions is required'
        );
        await expect(
            getTransactionWidgets(
                {
                    conditions: { operator: 'AND', operands: [] },
                    widgets: []
                },
                {}
            )
        ).rejects.toThrow('widgets must be a non-empty array');
        expect(fetchTransactionsByConditions).not.toHaveBeenCalled();
    });

    it('rejects unknown widget types during validation', async () => {
        await expect(
            getTransactionWidgets(
                {
                    conditions: { operator: 'AND', operands: [] },
                    widgets: [{ type: 'UNKNOWN_WIDGET' }]
                },
                {}
            )
        ).rejects.toThrow('Unknown widget type: UNKNOWN_WIDGET');
    });

    it('resolves valid credit cards when CREDIT_CARD_SPENDS is requested', async () => {
        resolveValidCreditCards.mockResolvedValue({
            validCreditCardIds: new Set(['cc1']),
            creditCardMap: new Map([
                ['cc1', { name: 'HDFC Regalia', last4: '1234', bank: 'HDFC' }]
            ])
        });

        const input = {
            conditions: {
                operator: 'AND',
                operands: [{ attribute: 'type', operator: 'is', value: 'DEBIT' }]
            },
            widgets: [{ type: 'CREDIT_CARD_SPENDS' }]
        };

        const result = await getTransactionWidgets(input, { userId: 'user-1' });

        expect(resolveValidCreditCards).toHaveBeenCalledWith(sampleTransactions, 'user-1');
        expect(result.data.widgets.CREDIT_CARD_SPENDS).toEqual({
            total: 100,
            cards: [{ name: 'HDFC Regalia', amount: 100, percent: 100 }]
        });
    });

    it('rejects invalid TOP_MERCHANTS limit', async () => {
        await expect(
            getTransactionWidgets(
                {
                    conditions: { operator: 'AND', operands: [] },
                    widgets: [{ type: 'TOP_MERCHANTS', config: { limit: 0 } }]
                },
                {}
            )
        ).rejects.toThrow('TOP_MERCHANTS config.limit must be a positive number');
    });
});
