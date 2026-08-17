jest.mock('../transactionService', () => ({
    createFromReview: jest.fn(),
    assertTransactionPersisted: jest.fn()
}));

jest.mock('../../models/Transaction', () => ({
    findOne: jest.fn()
}));

jest.mock('../../models/CreditCard', () => ({
    findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
    })
}));

jest.mock('../../models/BankAccount', () => ({
    findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439013' })
    })
}));

const mockFindOneAndUpdate = jest.fn();
const mockFindById = jest.fn();

jest.mock('../../models/TransactionsToReview', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: (...args) => mockFindOneAndUpdate(...args),
    findById: (...args) => mockFindById(...args)
}));

const transactionService = require('../transactionService');
const TransactionsToReview = require('../../models/TransactionsToReview');
const { approve } = require('../transactionsToReviewService');

const userId = '507f1f77bcf86cd799439011';
const reviewId = '507f1f77bcf86cd799439012';

const readyReviewDoc = {
    _id: reviewId,
    userId,
    status: 'READY_TO_REVIEW',
    messageId: 'msg-001',
    amount: 500,
    type: 'CREDIT',
    date: new Date('2025-06-01'),
    cycle: '06-2025',
    merchantRaw: 'Test',
    merchantNormalized: 'Test',
    name: 'Test',
    paymentMode: 'UPI',
    paymentSource: {
        kind: 'BANK_ACCOUNT',
        instrumentId: '507f1f77bcf86cd799439013',
        refModel: 'BankAccount'
    },
    isCreditCardRepayment: false,
    toObject() {
        return { ...this };
    }
};

describe('transactionsToReviewService isPrivate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        TransactionsToReview.findOne.mockResolvedValue(readyReviewDoc);
        mockFindOneAndUpdate.mockImplementation((_filter, update) => ({
            lean: jest.fn().mockResolvedValue({
                ...readyReviewDoc,
                status: 'APPROVED',
                ...update.$set
            })
        }));
        mockFindById.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ...readyReviewDoc,
                status: 'APPROVED',
                userApprovedData: { isPrivate: true, isCreditCardRepayment: false }
            })
        });
        transactionService.createFromReview.mockResolvedValue({
            _id: 'txn-id',
            isPrivate: true
        });
        transactionService.assertTransactionPersisted.mockImplementation((_uid, txn) => txn);
    });

    it('stores isPrivate in userApprovedData only when approving', async () => {
        await approve(userId, reviewId, { isPrivate: true });

        expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                $set: expect.objectContaining({
                    userApprovedData: expect.objectContaining({ isPrivate: true })
                })
            }),
            expect.any(Object)
        );
        expect(mockFindOneAndUpdate.mock.calls[0][1].$set).not.toHaveProperty('isPrivate');
    });

    it('defaults isPrivate to false in userApprovedData when not provided', async () => {
        await approve(userId, reviewId, {});

        expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                $set: expect.objectContaining({
                    userApprovedData: expect.objectContaining({ isPrivate: false })
                })
            }),
            expect.any(Object)
        );
    });

    it('passes updated review to createFromReview', async () => {
        await approve(userId, reviewId, { isPrivate: true });

        expect(transactionService.createFromReview).toHaveBeenCalledWith(
            expect.objectContaining({
                userApprovedData: expect.objectContaining({ isPrivate: true })
            }),
            'MANUAL'
        );
    });
});
