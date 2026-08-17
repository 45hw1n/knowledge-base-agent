const mockSave = jest.fn().mockResolvedValue(undefined);

function chainableLean(result) {
    return {
        sort: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(result)
            })
        }),
        lean: jest.fn().mockResolvedValue(result)
    };
}

const mockFindOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();

jest.mock('../googleSheetService', () => ({
    appendTransaction: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../../models/UserPreferences', () => ({
    findOne: jest.fn()
}));

jest.mock('../../models/TransactionsToReview', () => ({
    findOneAndUpdate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
    }),
    updateOne: jest.fn().mockResolvedValue({})
}));

jest.mock('../../models/Transaction', () => {
    const MockTransaction = jest.fn().mockImplementation(function MockTransaction(data) {
        Object.assign(this, data);
        this.save = mockSave;
        this.toObject = () => ({ ...data, _id: 'new-txn-id' });
    });
    MockTransaction.findOne = mockFindOne;
    MockTransaction.findOneAndUpdate = mockFindOneAndUpdate;
    MockTransaction.updateOne = jest.fn().mockResolvedValue({});
    return MockTransaction;
});

jest.mock('../../models/BankAccount', () => ({
    findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439013' })
    })
}));

const UserPreferences = require('../../models/UserPreferences');
const googleSheetService = require('../googleSheetService');
const {
    syncFromReview,
    createFromReview,
    createManual
} = require('../transactionService');

const userId = '507f1f77bcf86cd799439011';
const reviewId = '507f1f77bcf86cd799439012';

const baseReview = {
    _id: reviewId,
    userId,
    messageId: 'msg-001',
    amount: 500,
    currency: 'INR',
    type: 'CREDIT',
    date: new Date('2025-06-01'),
    cycle: '06-2025',
    merchantRaw: 'Test Merchant',
    merchantNormalized: 'Test Merchant',
    paymentMode: 'UPI',
    paymentSource: {
        kind: 'BANK_ACCOUNT',
        instrumentId: '507f1f77bcf86cd799439013',
        refModel: 'BankAccount'
    },
    isCreditCardRepayment: false
};

describe('transactionService isPrivate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSave.mockResolvedValue(undefined);
        mockFindOne.mockImplementation(() => chainableLean(null));
        mockFindOneAndUpdate.mockImplementation(() =>
            chainableLean({ _id: 'existing-txn', isPrivate: true })
        );
    });

    describe('syncFromReview', () => {
        it('sets isPrivate from userApprovedData.isPrivate', async () => {
            mockFindOne.mockImplementation(() =>
                chainableLean({ _id: 'existing-txn', messageId: 'msg-001', userId })
            );

            await syncFromReview(
                { ...baseReview, userApprovedData: { isPrivate: true } },
                'MANUAL'
            );

            expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
                expect.any(Object),
                { $set: expect.objectContaining({ isPrivate: true }) },
                expect.any(Object)
            );
        });

        it('defaults isPrivate to false without userApprovedData', async () => {
            mockFindOne.mockImplementation(() =>
                chainableLean({ _id: 'existing-txn', messageId: 'msg-001', userId })
            );

            await syncFromReview(baseReview, 'AI');

            expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
                expect.any(Object),
                { $set: expect.objectContaining({ isPrivate: false }) },
                expect.any(Object)
            );
        });
    });

    describe('createFromReview', () => {
        beforeEach(() => {
            UserPreferences.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({ googleSheetId: 'sheet-123' })
            });
        });

        it('creates private transaction without sheet sync queue', async () => {
            const result = await createFromReview(
                { ...baseReview, userApprovedData: { isPrivate: true } },
                'MANUAL'
            );

            expect(result.isPrivate).toBe(true);
            expect(result.sheetSyncStatus).toBeNull();
            expect(googleSheetService.appendTransaction).not.toHaveBeenCalled();
        });

        it('queues sheet sync for non-private transaction when sheet configured', async () => {
            const result = await createFromReview(
                { ...baseReview, userApprovedData: { isPrivate: false } },
                'MANUAL'
            );

            expect(result.isPrivate).toBe(false);
            expect(result.sheetSyncStatus).toBe('PENDING');
            expect(googleSheetService.appendTransaction).toHaveBeenCalled();
        });

        it('defaults isPrivate to false on auto-approve without userApprovedData', async () => {
            const result = await createFromReview(baseReview, 'AI');

            expect(result.isPrivate).toBe(false);
        });
    });

    describe('createManual', () => {
        beforeEach(() => {
            UserPreferences.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({ googleSheetId: 'sheet-123' })
            });
        });

        it('creates private manual transaction without sheet sync queue', async () => {
            const result = await createManual(userId, {
                amount: 100,
                type: 'CREDIT',
                date: '2025-06-01',
                name: 'Manual Txn',
                paymentMode: 'UPI',
                paymentSource: {
                    kind: 'BANK_ACCOUNT',
                    instrumentId: '507f1f77bcf86cd799439013'
                },
                isPrivate: true
            });

            expect(result.isPrivate).toBe(true);
            expect(result.sheetSyncStatus).toBeNull();
            expect(googleSheetService.appendTransaction).not.toHaveBeenCalled();
        });

        it('queues sheet sync for non-private manual transaction', async () => {
            const result = await createManual(userId, {
                amount: 100,
                type: 'CREDIT',
                date: '2025-06-01',
                name: 'Manual Txn',
                paymentMode: 'UPI',
                paymentSource: {
                    kind: 'BANK_ACCOUNT',
                    instrumentId: '507f1f77bcf86cd799439013'
                },
                isPrivate: false
            });

            expect(result.isPrivate).toBe(false);
            expect(result.sheetSyncStatus).toBe('PENDING');
            expect(googleSheetService.appendTransaction).toHaveBeenCalled();
        });
    });
});
