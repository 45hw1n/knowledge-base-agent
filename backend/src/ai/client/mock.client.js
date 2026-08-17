const mockClient = {
    async generate(prompt, options = {}) {
        const { feature } = options;

        if (feature === 'processDebitEmails') {
            return JSON.stringify({
                transactionDetails: {
                    amount: 100,
                    merchant: 'Mock Merchant',
                    date: new Date().toISOString(),
                },
                confidence: 'High',
            });
        }

        return JSON.stringify({
            message: 'Mock response for unknown feature',
            receivedPrompt: prompt,
            status: 'success',
        });
    },
};

module.exports = mockClient;
