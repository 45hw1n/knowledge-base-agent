const { buildTotalSpends } = require('./totalSpends');
const { buildSpendByCategory } = require('./spendByCategory');
const { buildCreditCardSpends } = require('./creditCardSpends');
const { buildTopMerchants } = require('./topMerchants');
const { buildPaymentModes } = require('./paymentModes');
const { buildTrend } = require('./trend');

const WIDGET_BUILDERS = {
    TOTAL_SPENDS: buildTotalSpends,
    SPEND_BY_CATEGORY: buildSpendByCategory,
    CREDIT_CARD_SPENDS: buildCreditCardSpends,
    TOP_MERCHANTS: buildTopMerchants,
    PAYMENT_MODES: buildPaymentModes,
    TREND: buildTrend
};

const WIDGET_TYPES = Object.keys(WIDGET_BUILDERS);

module.exports = {
    WIDGET_BUILDERS,
    WIDGET_TYPES
};
