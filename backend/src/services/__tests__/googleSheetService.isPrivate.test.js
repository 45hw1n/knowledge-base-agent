const mockFind = jest.fn();
const mockUpdateMany = jest.fn().mockResolvedValue({});

jest.mock('../../models/Transaction', () => ({
    find: mockFind,
    updateMany: mockUpdateMany
}));

jest.mock('../../models/UserPreferences', () => ({
    findOne: jest.fn()
}));

jest.mock('../../models/CreditCard', () => ({
    find: jest.fn().mockResolvedValue([])
}));

jest.mock('../../models/BankAccount', () => ({
    find: jest.fn().mockResolvedValue([])
}));

jest.mock('../gmailService', () => ({
    getAuthenticatedClient: jest.fn(),
    hasRequiredScopes: jest.fn().mockResolvedValue({ hasScopes: true, missingScopes: [] }),
    SHEETS_REQUIRED_SCOPES: []
}));

jest.mock('googleapis', () => ({
    google: {
        sheets: jest.fn()
    }
}));

const UserPreferences = require('../../models/UserPreferences');
const { appendTransaction, appendTransactions, getPendingSheetSync } = require('../googleSheetService');

describe('googleSheetService isPrivate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFind.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([])
        });
    });

    describe('appendTransaction', () => {
        it('skips private transactions without marking failed', async () => {
            const result = await appendTransaction('user-1', {
                _id: 'txn-1',
                displayId: 'TXN-001',
                isPrivate: true
            });

            expect(result).toEqual({ success: true, skipped: true });
        });
    });

    describe('appendTransactions', () => {
        it('filters out private transactions from batch sync', async () => {
            const { getAuthenticatedClient } = require('../gmailService');
            const { google } = require('googleapis');

            UserPreferences.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({ googleSheetId: 'sheet-123' })
            });
            getAuthenticatedClient.mockResolvedValue({ client: {} });

            const mockAppend = jest.fn().mockResolvedValue({});
            const mockGet = jest.fn().mockResolvedValue({ data: { values: [] } });
            const mockUpdate = jest.fn().mockResolvedValue({});

            google.sheets.mockReturnValue({
                spreadsheets: {
                    values: {
                        get: mockGet,
                        append: mockAppend,
                        update: mockUpdate
                    }
                }
            });

            const result = await appendTransactions('user-1', [
                { _id: '1', displayId: 'TXN-001', isPrivate: true, paymentSource: {} },
                {
                    _id: '2',
                    displayId: 'TXN-002',
                    isPrivate: false,
                    date: new Date(),
                    amount: 100,
                    paymentSource: {}
                }
            ]);

            expect(result.success).toBe(true);
            expect(mockAppend).toHaveBeenCalledTimes(1);
            expect(mockAppend.mock.calls[0][0].requestBody.values).toHaveLength(1);
        });

        it('returns early when all transactions are private', async () => {
            const result = await appendTransactions('user-1', [
                { _id: '1', displayId: 'TXN-001', isPrivate: true }
            ]);

            expect(result).toEqual({ success: true, syncedCount: 0 });
        });
    });

    describe('getPendingSheetSync', () => {
        it('excludes private transactions from pending sync query', async () => {
            await getPendingSheetSync('user-1', 25);

            expect(mockFind).toHaveBeenCalledWith({
                userId: 'user-1',
                sheetSyncStatus: 'PENDING',
                isDeleted: { $ne: true },
                isPrivate: { $ne: true }
            });
        });
    });
});
