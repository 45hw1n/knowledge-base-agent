// Canned per-type structured responses for the `extractEntities` feature —
// mirrors the flat-object shape each type's prompt (ai/orchestrator/prompts/)
// asks for and each validateExtracted<Type>() expects, so the pipeline runs
// end-to-end in dev/test without a real AI provider. Keyed by
// options.type, which the orchestrator always supplies for this feature.
const MOCK_EXTRACTIONS = {
    INVOICE: {
        found: true,
        invoiceNumber: 'INV-MOCK-001',
        amount: { value: 500, currency: 'USD' },
        dueDate: null,
        issuer: { name: 'Mock Vendor', email: 'billing@mockvendor.example' },
    },
    PAYMENT: {
        found: true,
        amount: { value: 500, currency: 'USD' },
        paidAt: new Date(0).toISOString(),
        payer: null,
        payee: { name: 'Mock Vendor', email: 'billing@mockvendor.example' },
    },
};

// Keyword -> {intent, dataSources} for the mock `chatIntent` feature — only
// matched against the actual user message (isolated below), never the full
// prompt, since the prompt's own intent-description block always mentions
// every keyword regardless of what the user actually typed.
const CHAT_INTENT_KEYWORDS = [
    { keyword: 'invoice', intent: 'GET_INVOICES', dataSources: ['INVOICE'] },
    { keyword: 'ticket', intent: 'GET_TICKETS', dataSources: ['TICKET'] },
    { keyword: 'payment', intent: 'GET_PAYMENTS', dataSources: ['PAYMENT'] },
    { keyword: 'meeting', intent: 'GET_EVENTS', dataSources: ['EVENT'] },
    { keyword: 'event', intent: 'GET_EVENTS', dataSources: ['EVENT'] },
    { keyword: 'document', intent: 'GET_DOCUMENTS', dataSources: ['DOCUMENT'] },
    { keyword: 'contract', intent: 'GET_DOCUMENTS', dataSources: ['DOCUMENT'] },
];

const mockClient = {
    async generate(prompt, options = {}) {
        const { feature, type } = options;

        if (feature === 'extractEntities') {
            const extraction = MOCK_EXTRACTIONS[type];
            return JSON.stringify(extraction || { found: false });
        }

        if (feature === 'summarizeEmail') {
            return JSON.stringify({ summary: 'Mock summary of the email content.' });
        }

        if (feature === 'chatIntent') {
            const userMessageMatch = String(prompt).match(/User's latest message:\n([\s\S]*)$/);
            const userMessage = (userMessageMatch ? userMessageMatch[1] : '').toLowerCase();
            const match = CHAT_INTENT_KEYWORDS.find(({ keyword }) => userMessage.includes(keyword));
            return JSON.stringify({
                intent: match ? match.intent : 'UNSUPPORTED',
                dataSources: match ? match.dataSources : [],
                filters: {},
            });
        }

        if (feature === 'chatResponse') {
            const displayIdMatches = String(prompt).match(/\b(?:TKT|INV|PAY|EVT|DOC)-\d+\b/g) || [];
            const referencedDisplayIds = [...new Set(displayIdMatches)].slice(0, 3);
            const message = referencedDisplayIds.length
                ? `Here's what I found: ${referencedDisplayIds.join(', ')}.`
                : "I couldn't find anything matching that.";
            return JSON.stringify({ message, referencedDisplayIds });
        }

        if (feature === 'chatTitle') {
            return 'Mock conversation';
        }

        return JSON.stringify({
            message: 'Mock response for unknown feature',
            receivedPrompt: prompt,
            status: 'success',
        });
    },
};

module.exports = mockClient;
