const mongoose = require('mongoose');
const CreditCard = require('../models/CreditCard');

/**
 * @param {unknown} userId
 * @returns {import('mongoose').Types.ObjectId | unknown}
 */
function parseUserId(userId) {
    if (userId == null) {
        return userId;
    }

    if (mongoose.Types.ObjectId.isValid(userId)) {
        return new mongoose.Types.ObjectId(userId);
    }

    return userId;
}

/**
 * @param {import('./types').NormalizedTransaction[]} transactions
 * @param {unknown} userId
 * @returns {Promise<{
 *   validCreditCardIds: Set<string>;
 *   creditCardMap: Map<string, { name: string; last4: string; bank: string }>;
 * }>}
 */
async function resolveValidCreditCards(transactions, userId) {
    const instrumentIds = new Set();

    for (const transaction of transactions) {
        const paymentSource = transaction.paymentSource;

        if (paymentSource?.kind === 'CREDIT_CARD' && paymentSource.instrumentId) {
            instrumentIds.add(String(paymentSource.instrumentId));
        }
    }

    if (instrumentIds.size === 0) {
        return {
            validCreditCardIds: new Set(),
            creditCardMap: new Map()
        };
    }

    const cards = await CreditCard.find(
        {
            _id: { $in: Array.from(instrumentIds) },
            userId: parseUserId(userId)
        },
        { name: 1, last4: 1, bank: 1 }
    ).lean();

    const validCreditCardIds = new Set();
    const creditCardMap = new Map();

    for (const card of cards) {
        const id = card._id.toString();
        validCreditCardIds.add(id);
        creditCardMap.set(id, {
            name: card.name,
            last4: card.last4,
            bank: card.bank
        });
    }

    return { validCreditCardIds, creditCardMap };
}

module.exports = { resolveValidCreditCards };
