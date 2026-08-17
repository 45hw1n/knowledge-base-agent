const mockFindOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();

jest.mock('../../models/Transaction', () => ({
    findOne: (...args) => mockFindOne(...args),
    findOneAndUpdate: (...args) => mockFindOneAndUpdate(...args)
}));

jest.mock('../../models/TransactionsToReview', () => ({
    updateOne: jest.fn().mockResolvedValue({})
}));

jest.mock('../../models/UserPreferences', () => ({}));
jest.mock('../googleSheetService', () => ({}));
jest.mock('../../models/CreditCard', () => ({}));
jest.mock('../../models/BankAccount', () => ({}));

jest.mock('../attachments/attachmentService', () => ({
    stageAttachmentsForDeletion: jest.fn(),
    rollbackStagedAttachmentDeletion: jest.fn(),
    finalizeStagedAttachmentDeletion: jest.fn()
}));

const attachmentService = require('../attachments/attachmentService');
const { editTransaction } = require('../transactionService');

const attachment = {
    _id: 'attachment-1',
    storageKey: 'users/user-1/transactions/transaction-1/attachment-1.pdf'
};
const existing = {
    _id: 'transaction-1',
    userId: 'user-1',
    type: 'CREDIT',
    approvalActor: 'MANUAL',
    attachments: [attachment],
    toObject: () => ({ ...existing })
};
const receipt = {
    entries: [{
        attachmentId: 'attachment-1',
        sourceKey: attachment.storageKey,
        backupKey: `${attachment.storageKey}.backup`
    }]
};

describe('transaction attachment deletion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindOne.mockResolvedValue(existing);
        mockFindOneAndUpdate.mockResolvedValue({
            toObject: () => ({ ...existing, attachments: [] })
        });
        attachmentService.stageAttachmentsForDeletion.mockResolvedValue(receipt);
        attachmentService.rollbackStagedAttachmentDeletion.mockResolvedValue(undefined);
        attachmentService.finalizeStagedAttachmentDeletion.mockResolvedValue(undefined);
    });

    it('stages storage deletion and removes metadata in the transaction update', async () => {
        const result = await editTransaction(
            'user-1',
            'transaction-1',
            {},
            ['attachment-1']
        );

        expect(attachmentService.stageAttachmentsForDeletion).toHaveBeenCalledWith([
            attachment
        ]);
        expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ _id: 'transaction-1', userId: 'user-1' }),
            {
                $set: {},
                $pull: {
                    attachments: { _id: { $in: ['attachment-1'] } }
                }
            },
            { new: true, runValidators: true }
        );
        expect(attachmentService.finalizeStagedAttachmentDeletion).toHaveBeenCalledWith(
            receipt
        );
        expect(result.attachments).toEqual([]);
    });

    it('rejects attachment IDs that do not belong to the transaction', async () => {
        await expect(
            editTransaction('user-1', 'transaction-1', {}, ['unknown'])
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

        expect(attachmentService.stageAttachmentsForDeletion).not.toHaveBeenCalled();
    });

    it('restores storage objects when the transaction update fails', async () => {
        mockFindOneAndUpdate.mockResolvedValue(null);

        await expect(
            editTransaction('user-1', 'transaction-1', {}, ['attachment-1'])
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });

        expect(attachmentService.rollbackStagedAttachmentDeletion).toHaveBeenCalledWith(
            receipt
        );
        expect(attachmentService.finalizeStagedAttachmentDeletion).not.toHaveBeenCalled();
    });
});
