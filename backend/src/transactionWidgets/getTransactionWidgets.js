const { WIDGET_BUILDERS } = require('./builders');
const { fetchTransactionsByConditions } = require('./fetchTransactions');
const { resolveValidCreditCards } = require('./resolveValidCreditCards');
const { validateInput } = require('./validateInput');

/**
 * @param {import('./types').GetTransactionWidgetsInput} input
 * @param {Record<string, unknown>} runtimeContext
 * @returns {Promise<import('./types').GetTransactionWidgetsResponse>}
 */
async function getTransactionWidgets(input, runtimeContext) {
    validateInput(input);

    const transactions = await fetchTransactionsByConditions(input.conditions, runtimeContext);
    const widgets = {};

    const needsCreditCardValidation = input.widgets.some(
        (widget) => widget.type === 'CREDIT_CARD_SPENDS'
    );
    const creditCardContext = needsCreditCardValidation
        ? await resolveValidCreditCards(transactions, runtimeContext.userId)
        : null;

    for (const widget of input.widgets) {
        const builder = WIDGET_BUILDERS[widget.type];

        if (!builder) {
            continue;
        }

        const config =
            widget.type === 'CREDIT_CARD_SPENDS' && creditCardContext
                ? { ...widget.config, ...creditCardContext }
                : widget.config;

        widgets[widget.type] = builder(transactions, config);
    }

    return {
        data: {
            widgets
        }
    };
}

module.exports = { getTransactionWidgets };
