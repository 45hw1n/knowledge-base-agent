jest.mock('../../storage/storageService', () => ({
    copyObject: jest.fn(),
    deleteObject: jest.fn()
}));

const storageService = require('../../storage/storageService');
const {
    stageAttachmentsForDeletion,
    rollbackStagedAttachmentDeletion,
    finalizeStagedAttachmentDeletion
} = require('../attachmentService');

const attachments = [
    { _id: 'attachment-1', storageKey: 'transaction/attachment-1.pdf' },
    { _id: 'attachment-2', storageKey: 'transaction/attachment-2.pdf' }
];

describe('recoverable attachment storage deletion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        storageService.copyObject.mockResolvedValue(undefined);
        storageService.deleteObject.mockResolvedValue(undefined);
    });

    it('backs up every object before deleting originals', async () => {
        const receipt = await stageAttachmentsForDeletion(attachments);

        expect(storageService.copyObject).toHaveBeenCalledTimes(2);
        expect(storageService.deleteObject).toHaveBeenCalledWith({
            storageKey: attachments[0].storageKey
        });
        expect(receipt.entries[0]).toMatchObject({
            attachmentId: 'attachment-1',
            sourceKey: attachments[0].storageKey
        });
        expect(receipt.entries[0].backupKey).toContain('.pending-delete.');
    });

    it('restores already deleted originals when another deletion fails', async () => {
        const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        storageService.deleteObject.mockImplementation(({ storageKey }) => (
            storageKey === attachments[1].storageKey
                ? Promise.reject(new Error('delete failed'))
                : Promise.resolve()
        ));

        await expect(
            stageAttachmentsForDeletion(attachments)
        ).rejects.toMatchObject({
            code: 'ATTACHMENT_DELETE_FAILED',
            phase: 'DELETE_SOURCE'
        });

        expect(storageService.copyObject).toHaveBeenCalledWith(
            expect.objectContaining({
                destinationKey: attachments[0].storageKey
            })
        );
        logSpy.mockRestore();
    });

    it('can restore or finalize a staged deletion receipt', async () => {
        const receipt = await stageAttachmentsForDeletion([attachments[0]]);
        jest.clearAllMocks();
        storageService.copyObject.mockResolvedValue(undefined);
        storageService.deleteObject.mockResolvedValue(undefined);

        await rollbackStagedAttachmentDeletion(receipt);
        expect(storageService.copyObject).toHaveBeenCalledWith({
            sourceKey: receipt.entries[0].backupKey,
            destinationKey: receipt.entries[0].sourceKey
        });

        jest.clearAllMocks();
        storageService.deleteObject.mockResolvedValue(undefined);
        await finalizeStagedAttachmentDeletion(receipt);
        expect(storageService.deleteObject).toHaveBeenCalledWith({
            storageKey: receipt.entries[0].backupKey
        });
    });
});
