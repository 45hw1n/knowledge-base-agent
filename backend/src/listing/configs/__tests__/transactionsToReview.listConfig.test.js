const { transactionsToReviewListConfig } = require('../transactionsToReview.listConfig');

describe('transactionsToReview.listConfig', () => {
    it('maps merchant list attribute to merchantNormalized', () => {
        expect(transactionsToReviewListConfig.fields.merchant.dbPath).toBe('merchantNormalized');
    });

    it('maps category filter to nested category.id', () => {
        expect(transactionsToReviewListConfig.fields.category.dbPath).toBe('category.id');
    });

    it('scopes tenant by userId only', () => {
        const match = transactionsToReviewListConfig.tenantMatchFactory({
            userId: '507f1f77bcf86cd799439011'
        });
        expect(match.userId.toString()).toBe('507f1f77bcf86cd799439011');
        expect(match.isActive).toBeUndefined();
    });
});
