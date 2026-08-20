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

        return JSON.stringify({
            message: 'Mock response for unknown feature',
            receivedPrompt: prompt,
            status: 'success',
        });
    },
};

module.exports = mockClient;
