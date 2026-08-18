const mockClient = {
    async generate(prompt, options = {}) {
        const { feature } = options;

        if (feature === 'extractEntities') {
            return JSON.stringify({
                entities: [
                    {
                        entityType: 'contact',
                        data: { name: 'Mock Contact', email: 'mock@example.com' },
                        confidence: 0.9,
                    },
                ],
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
