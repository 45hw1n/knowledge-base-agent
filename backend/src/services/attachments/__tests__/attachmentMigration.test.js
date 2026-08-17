jest.mock('../../storage/storageService', () => ({
    moveObjects: jest.fn()
}));

const storageService = require('../../storage/storageService');
const {
    moveAttachmentsBetweenOwners,
    rollbackAttachmentMigration
} = require('../attachmentService');
const { AttachmentOwnerType } = require('../attachmentOwnership');

const sourceOwner = {
    type: AttachmentOwnerType.REVIEW,
    id: 'review-1'
};
const destinationOwner = {
    type: AttachmentOwnerType.TRANSACTION,
    id: 'transaction-1'
};
const attachment = {
    _id: 'attachment-1',
    storageKey: 'opaque-source-key.without-a-useful-extension',
    fileName: 'receipt.original',
    mimeType: 'application/pdf',
    size: 42,
    uploadedAt: new Date('2026-08-01T10:00:00.000Z')
};

describe('attachment storage migration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        storageService.moveObjects.mockResolvedValue([]);
    });

    it('builds destination keys from owner and MIME type', async () => {
        const migration = await moveAttachmentsBetweenOwners({
            userId: 'user-1',
            sourceOwner,
            destinationOwner,
            attachments: [attachment]
        });

        expect(migration.attachments[0]).toMatchObject({
            _id: 'attachment-1',
            storageKey: 'users/user-1/transactions/transaction-1/attachment-1.pdf',
            mimeType: 'application/pdf'
        });
        expect(storageService.moveObjects).toHaveBeenCalledWith([{
            attachmentId: 'attachment-1',
            sourceKey: attachment.storageKey,
            destinationKey: 'users/user-1/transactions/transaction-1/attachment-1.pdf'
        }]);
    });

    it('does not touch storage for an empty attachment array', async () => {
        const migration = await moveAttachmentsBetweenOwners({
            userId: 'user-1',
            sourceOwner,
            destinationOwner,
            attachments: []
        });

        expect(migration.attachments).toEqual([]);
        expect(storageService.moveObjects).not.toHaveBeenCalled();
    });

    it('rolls a completed migration back using reverse storage pairs', async () => {
        const migration = await moveAttachmentsBetweenOwners({
            userId: 'user-1',
            sourceOwner,
            destinationOwner,
            attachments: [attachment]
        });
        storageService.moveObjects.mockClear();

        await rollbackAttachmentMigration(migration);

        expect(storageService.moveObjects).toHaveBeenCalledWith([{
            attachmentId: 'attachment-1',
            sourceKey: 'users/user-1/transactions/transaction-1/attachment-1.pdf',
            destinationKey: attachment.storageKey
        }]);
    });
});
