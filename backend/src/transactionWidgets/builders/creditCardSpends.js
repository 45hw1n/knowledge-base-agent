const { groupBy, sumAmounts, calculatePercent, sortByAmountDesc } = require('../utils/aggregation');

/**
 * @param {import('../types').NormalizedTransaction} transaction
 * @param {Set<string>} validCreditCardIds
 * @returns {boolean}
 */
function isCreditCardTransaction(transaction, validCreditCardIds) {
    const instrumentId = transaction.paymentSource?.instrumentId;

    return (
        transaction.paymentSource?.kind === 'CREDIT_CARD' &&
        instrumentId != null &&
        validCreditCardIds.has(String(instrumentId))
    );
}

/**
 * @param {import('../types').NormalizedTransaction} transaction
 * @param {Map<string, { name: string; last4: string; bank: string }>} creditCardMap
 * @returns {string}
 */
function getCardName(transaction, creditCardMap) {
    const instrumentId = transaction.paymentSource?.instrumentId;

    if (instrumentId) {
        const card = creditCardMap.get(String(instrumentId));

        if (card?.name) {
            return card.name;
        }

        if (card?.last4) {
            return `•••• ${card.last4}`;
        }
    }

    const paymentSource = transaction.paymentSource;

    if (!paymentSource) {
        return 'Unknown';
    }

    if (paymentSource.displayName) {
        return paymentSource.displayName;
    }

    if (paymentSource.last4) {
        return `•••• ${paymentSource.last4}`;
    }

    return 'Unknown';
}

/**
 * @param {import('../types').NormalizedTransaction[]} transactions
 * @param {{
 *   validCreditCardIds?: Set<string>;
 *   creditCardMap?: Map<string, { name: string; last4: string; bank: string }>;
 * } | undefined} config
 * @returns {import('../types').CreditCardSpendsWidget}
 */
function buildCreditCardSpends(transactions, config) {
    const validCreditCardIds = config?.validCreditCardIds ?? new Set();
    const creditCardMap = config?.creditCardMap ?? new Map();

    const creditCardTransactions = transactions.filter((transaction) =>
        isCreditCardTransaction(transaction, validCreditCardIds)
    );
    const total = sumAmounts(creditCardTransactions);
    const grouped = groupBy(creditCardTransactions, (transaction) =>
        getCardName(transaction, creditCardMap)
    );

    const cards = sortByAmountDesc(
        Array.from(grouped.entries()).map(([name, items]) => {
            const amount = sumAmounts(items);

            return {
                name,
                amount,
                percent: calculatePercent(amount, total)
            };
        }),
        (item) => item.amount
    );

    return { total, cards };
}

module.exports = { buildCreditCardSpends, isCreditCardTransaction };
