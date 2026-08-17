jest.mock('../../../../services/transactionsToReviewService', () => ({
    save: jest.fn(),
    updateStatus: jest.fn(),
    promoteApprovedReview: jest.fn(),
    findByMessageId: jest.fn()
}));

jest.mock('../../../../models/UserPreferences', () => ({
    findOne: jest.fn()
}));

const transactionsToReviewService = require('../../../../services/transactionsToReviewService');
const UserPreferences = require('../../../../models/UserPreferences');
const repository = require('../repository');

describe('auto approval promotion', () => {
    it('uses the shared promotion workflow', async () => {
        const review = {
            _id: 'review-1',
            userId: 'user-1',
            messageId: 'message-1'
        };
        transactionsToReviewService.save.mockResolvedValue(review);
        transactionsToReviewService.updateStatus.mockResolvedValue({
            ...review,
            status: 'AUTO_APPROVED'
        });
        transactionsToReviewService.promoteApprovedReview.mockResolvedValue({
            review,
            transaction: { _id: 'transaction-1', displayId: 'TXN-1' }
        });
        UserPreferences.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({ autoProcess: true })
        });

        await repository.save(review);

        expect(transactionsToReviewService.promoteApprovedReview).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'AUTO_APPROVED' }),
            'AI'
        );
    });
});
