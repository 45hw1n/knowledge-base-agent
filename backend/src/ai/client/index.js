const openaiClient = require('./openai.client');
const geminiClient = require('./gemini.client');
const mockClient = require('./mock.client');

const providers = {
    openai: openaiClient,
    gemini: geminiClient,
    mock: mockClient,
};

const aiClient = {
    async generate(prompt, options = {}) {
        const providerName = options.provider || process.env.AI_PROVIDER || 'mock';
        const client = providers[providerName];

        if (!client) {
            throw new Error(`AI provider "${providerName}" is not supported.`);
        }

        try {
            return await client.generate(prompt, options);
        } catch (error) {
            console.log(error, `ERROR: WITH THE AI PROVIDER ${providerName}`)
            throw error;
        }
    },
};

module.exports = aiClient;
