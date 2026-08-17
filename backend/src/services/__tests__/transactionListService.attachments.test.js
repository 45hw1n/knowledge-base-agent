const { normalizeTransaction } = require('../transactionListService');

describe('transaction attachment query mapping', () => {
    it('exposes attachments using the shared GraphQL shape', () => {
        const uploadedAt = new Date('2026-08-01T10:00:00.000Z');
        const transaction = normalizeTransaction({
            _id: 'transaction-1',
            displayId: 'TXN-20260801-001',
            amount: 42,
            currency: 'INR',
            type: 'DEBIT',
            date: uploadedAt,
            name: 'Test',
            merchantNormalized: 'Test',
            paymentMode: 'UPI',
            attachments: [{
                _id: 'attachment-1',
                storageKey: 'private-storage-key',
                fileName: 'receipt.pdf',
                mimeType: 'application/pdf',
                size: 100,
                uploadedAt
            }],
            createdAt: uploadedAt
        });

        expect(transaction.attachments).toEqual([{
            id: 'attachment-1',
            fileName: 'receipt.pdf',
            mimeType: 'application/pdf',
            size: 100,
            uploadedAt: uploadedAt.toISOString()
        }]);
        expect(transaction.attachments[0]).not.toHaveProperty('storageKey');
    });
});
