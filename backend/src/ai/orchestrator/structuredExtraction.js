const aiClient = require('../client');
const { buildInvoicePrompt } = require('./prompts/invoicePrompt');
const { buildPaymentPrompt } = require('./prompts/paymentPrompt');
const { buildEventPrompt } = require('./prompts/eventPrompt');
const { buildTicketPrompt } = require('./prompts/ticketPrompt');
const { buildDocumentPrompt } = require('./prompts/documentPrompt');

// Dispatch table, not a per-type processor — the mechanics of building a
// prompt, calling the AI, and parsing its response are identical regardless
// of type; only the prompt itself differs. See decisions.md.
const PROMPT_BUILDERS = {
    INVOICE: buildInvoicePrompt,
    PAYMENT: buildPaymentPrompt,
    EVENT: buildEventPrompt,
    TICKET: buildTicketPrompt,
    DOCUMENT: buildDocumentPrompt,
};

/**
 * Parses the AI's raw JSON response into a flat fields object. Type-agnostic
 * — every type's prompt asks for the same envelope (`{"found": bool, ...}`),
 * so this parsing step is shared rather than duplicated per type.
 */
function parseStructuredResponse(rawResponse) {
    let parsed;
    try {
        const cleaned = String(rawResponse).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
        parsed = JSON.parse(cleaned);
    } catch (error) {
        return { data: null, error: `Failed to parse AI response as JSON: ${error.message}` };
    }

    if (!parsed || typeof parsed !== 'object') {
        return { data: null, error: 'AI response is not a JSON object' };
    }

    if (parsed.found === false) {
        // Not an error — the text genuinely didn't describe this type.
        return { data: null, error: null };
    }

    const { found, ...fields } = parsed;
    return { data: fields, error: null };
}

/**
 * Runs type-specific structured extraction against a block of text —
 * either an attachment's OCR'd text (called from documentProcessor.js) or
 * an email body (called directly from the orchestrator as the fallback
 * when no attachment produced usable data). Same function either way; only
 * the input text source differs.
 *
 * @param {string} text
 * @param {string} type - one of Entity.ENTITY_TYPES
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
async function runStructuredExtraction(text, type) {
    const buildPrompt = PROMPT_BUILDERS[type];
    if (!buildPrompt) {
        return { data: null, error: `No extraction prompt configured for type "${type}"` };
    }

    if (!text || !text.trim()) {
        // Nothing to extract from — not an error, just nothing found.
        return { data: null, error: null };
    }

    const prompt = buildPrompt(text);
    const aiResponse = await aiClient.generate(prompt, { feature: 'extractEntities', type });
    return parseStructuredResponse(aiResponse);
}

module.exports = { runStructuredExtraction, parseStructuredResponse, PROMPT_BUILDERS };
