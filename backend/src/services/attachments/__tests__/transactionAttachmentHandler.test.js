const mockFindOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();

jest.mock('../../../models/Transaction', () => ({
    exists: jest.fn().mockResolvedValue({ _id: 'transaction-1' }),
    findOne: (...args) => mockFindOne(...args),
    findOneAndUpdate: (...args) => mockFindOneAndUpdate(...args)
}));

const handler = require('../entityHandlers/transactionAttachmentHandler');

const attachment = {
    _id: 'attachment-1',
    storageKey: 'transaction-key',
    fileName: 'receipt.pdf',
    mimeType: 'application/pdf',
    size: 42,
    uploadedAt: new Date('2026-08-01T10:00:00.000Z')
};

describe('transactionAttachmentHandler upload support', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('reports the persisted attachment count', async () => {
        mockFindOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({ attachments: [attachment] })
        });

        await expect(handler.getAttachmentCount('transaction-1')).resolves.toBe(1);
    });

    it('appends and returns normalized attachment metadata', async () => {
        mockFindOneAndUpdate.mockReturnValue({
            lean: jest.fn().mockResolvedValue({ attachments: [attachment] })
        });

        await expect(
            handler.appendAttachment('transaction-1', attachment)
        ).resolves.toMatchObject({
            id: 'attachment-1',
            storageKey: 'transaction-key',
            fileName: 'receipt.pdf'
        });
    });

    it('keeps direct transaction deletion disabled', () => {
        expect(handler.supportsDirectDelete).toBe(false);
        expect(() => handler.removeAttachment()).toThrow(
            'Transaction attachment CRUD is not implemented'
        );
    });
});
