const { createListService } = require('../listing/core');
const { creditCardsListConfig } = require('../listing/configs/creditCards.listConfig');
const { mapListError } = require('./mapListingErrors');

const creditCardListService = createListService(creditCardsListConfig);

function normalizeCreditCardDocument(card) {
    if (!card) return card;
    return {
        id: card._id.toString(),
        name: card.name,
        bank: card.bank,
        last4: card.last4,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        network: card.network,
        billingCycleDay: card.billingCycleDay,
        dueDateDay: card.dueDateDay,
        creditLimit: card.creditLimit,
        linkedBankAccountId: card.linkedBankAccountId ? card.linkedBankAccountId.toString() : null,
        isActive: card.isActive,
        createdAt: card.createdAt?.toISOString?.() || null,
        updatedAt: card.updatedAt?.toISOString?.() || null
    };
}

async function listCreditCards(request, runtimeContext) {
    const response = await creditCardListService.list(request, runtimeContext);
    return {
        ...response,
        data: response.data.map(normalizeCreditCardDocument)
    };
}

module.exports = {
    listCreditCards,
    mapListError
};

