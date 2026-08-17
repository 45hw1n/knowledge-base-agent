jest.mock('../transactionService', () => ({
    createFromReview: jest.fn()
}));

jest.mock('../attachments/attachmentService', () => ({
    moveAttachmentsBetweenOwners: jest.fn(),
    rollbackAttachmentMigration: jest.fn()
}));

jest.mock('../../models/Transaction', () => ({
    updateOne: jest.fn()
}));

jest.mock('../../models/TransactionsToReview', () => ({
    updateOne: jest.fn()
}));

jest.mock('../../models/CreditCard', () => ({}));
jest.mock('../../models/BankAccount', () => ({}));

const mongoose = require('mongoose');
const Transaction = require('../../models/Transaction');
const TransactionsToReview = require('../../models/TransactionsToReview');
const transactionService = require('../transactionService');
const attachmentService = require('../attachments/attachmentService');
const { promoteApprovedReview } = require('../transactionsToReviewService');

const reviewAttachment = {
    _id: 'attachment-1',
    storageKey: 'users/user-1/reviews/review-1/attachment-1.pdf',
    fileName: 'receipt.pdf',
    mimeType: 'application/pdf',
    size: 42,
    uploadedAt: new Date('2026-08-01T10:00:00.000Z')
};
const migratedAttachment = {
    ...reviewAttachment,
    storageKey: 'users/user-1/transactions/transaction-1/attachment-1.pdf'
};
const review = {
    _id: 'review-1',
    userId: 'user-1',
    messageId: 'message-1',
    attachments: [reviewAttachment]
};
const transaction = {
    _id: 'transaction-1',
    userId: 'user-1',
    attachments: []
};
const migration = {
    attachments: [migratedAttachment],
    sourceAttachments: [reviewAttachment],
    pairs: [{
        attachmentId: 'attachment-1',
        sourceKey: reviewAttachment.storageKey,
        destinationKey: migratedAttachment.storageKey
    }],
    sourceOwner: { type: 'REVIEW', id: 'review-1' },
    destinationOwner: { type: 'TRANSACTION', id: 'transaction-1' }
};

describe('review attachment ownership persistence', () => {
    let session;

    beforeEach(() => {
        jest.clearAllMocks();
        session = {
            withTransaction: jest.fn((operation) => operation()),
            endSession: jest.fn().mockResolvedValue(undefined)
        };
        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        transactionService.createFromReview.mockResolvedValue(transaction);
        attachmentService.moveAttachmentsBetweenOwners.mockResolvedValue(migration);
        attachmentService.rollbackAttachmentMigration.mockResolvedValue(undefined);
        Transaction.updateOne.mockResolvedValue({ matchedCount: 1 });
        TransactionsToReview.updateOne.mockResolvedValue({ matchedCount: 1 });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('uses one Mongo transaction update per owner and returns in-memory metadata', async () => {
        const result = await promoteApprovedReview(review, 'MANUAL');

        expect(Transaction.updateOne).toHaveBeenCalledTimes(1);
        expect(TransactionsToReview.updateOne).toHaveBeenCalledTimes(1);
        expect(Transaction.updateOne).toHaveBeenCalledWith(
            { _id: 'transaction-1', userId: 'user-1' },
            { $set: { attachments: [migratedAttachment] } },
            { session, runValidators: true }
        );
        expect(result.transaction.attachments).toEqual([migratedAttachment]);
        expect(result.review.attachments).toEqual([]);
        expect(attachmentService.rollbackAttachmentMigration).not.toHaveBeenCalled();
        expect(session.endSession).toHaveBeenCalled();
    });

    it('rolls R2 back when the Transaction metadata update fails', async () => {
        Transaction.updateOne.mockResolvedValue({ matchedCount: 0 });

        await expect(promoteApprovedReview(review, 'MANUAL')).rejects.toMatchObject({
            code: 'ATTACHMENT_OWNERSHIP_UPDATE_FAILED'
        });

        expect(TransactionsToReview.updateOne).not.toHaveBeenCalled();
        expect(attachmentService.rollbackAttachmentMigration).toHaveBeenCalledWith(migration);
    });

    it('rolls R2 back when the Review metadata update fails', async () => {
        TransactionsToReview.updateOne.mockResolvedValue({ matchedCount: 0 });

        await expect(promoteApprovedReview(review, 'MANUAL')).rejects.toMatchObject({
            code: 'ATTACHMENT_OWNERSHIP_UPDATE_FAILED'
        });

        expect(Transaction.updateOne).toHaveBeenCalledTimes(1);
        expect(attachmentService.rollbackAttachmentMigration).toHaveBeenCalledWith(migration);
    });

    it('logs recovery context when R2 rollback also fails', async () => {
        const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        Transaction.updateOne.mockResolvedValue({ matchedCount: 0 });
        attachmentService.rollbackAttachmentMigration.mockRejectedValue(
            new Error('rollback failed')
        );

        const error = await promoteApprovedReview(review, 'MANUAL').catch(
            (caught) => caught
        );

        expect(error.code).toBe('ATTACHMENT_OWNERSHIP_UPDATE_FAILED');
        expect(error.rollbackError.message).toBe('rollback failed');
        expect(logSpy).toHaveBeenCalledWith(
            '[AttachmentMigration] Mongo rollback compensation failed',
            expect.objectContaining({
                reviewId: 'review-1',
                transactionId: 'transaction-1',
                attachmentIds: ['attachment-1']
            })
        );
    });
});
