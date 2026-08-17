jest.mock('../../models/CreditCard', () => ({
    find: jest.fn()
}));

const CreditCard = require('../../models/CreditCard');
const { resolveValidCreditCards } = require('../resolveValidCreditCards');

describe('resolveValidCreditCards', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns empty context when no credit card payment sources exist', async () => {
        const transactions = [
            {
                paymentSource: {
                    kind: 'BANK_ACCOUNT',
                    instrumentId: 'ba1'
                }
            }
        ];

        const result = await resolveValidCreditCards(transactions, 'user-1');

        expect(result.validCreditCardIds).toEqual(new Set());
        expect(result.creditCardMap.size).toBe(0);
        expect(CreditCard.find).not.toHaveBeenCalled();
    });

    it('loads credit cards that exist for the user', async () => {
        CreditCard.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([
                {
                    _id: { toString: () => 'cc1' },
                    name: 'HDFC Regalia',
                    last4: '1234',
                    bank: 'HDFC'
                }
            ])
        });

        const transactions = [
            {
                paymentSource: {
                    kind: 'CREDIT_CARD',
                    instrumentId: 'cc1'
                }
            },
            {
                paymentSource: {
                    kind: 'CREDIT_CARD',
                    instrumentId: 'cc-missing'
                }
            }
        ];

        const result = await resolveValidCreditCards(transactions, 'user-1');

        expect(CreditCard.find).toHaveBeenCalledWith(
            {
                _id: { $in: ['cc1', 'cc-missing'] },
                userId: expect.anything()
            },
            { name: 1, last4: 1, bank: 1 }
        );
        expect(result.validCreditCardIds).toEqual(new Set(['cc1']));
        expect(result.creditCardMap.get('cc1')).toEqual({
            name: 'HDFC Regalia',
            last4: '1234',
            bank: 'HDFC'
        });
    });
});
