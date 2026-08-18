const googleDocumentAIClient = require('./googleDocumentAI.client');
const mockClient = require('./mock.client');

const providers = {
    'google-document-ai': googleDocumentAIClient,
    mock: mockClient,
};

/**
 * Provider-agnostic document parser — parses a raw document buffer (e.g. an
 * email attachment) into normalized text/structure, mirroring the ai/client
 * dispatch pattern (src/ai/client/index.js).
 */
const documentParserClient = {
    async parse(input, options = {}) {
        const providerName = options.provider || process.env.DOCUMENT_PARSER_PROVIDER || 'mock';
        const client = providers[providerName];

        if (!client) {
            throw new Error(`Document parser provider "${providerName}" is not supported.`);
        }

        try {
            return await client.parse(input);
        } catch (error) {
            console.log(error, `ERROR: WITH THE DOCUMENT PARSER PROVIDER ${providerName}`);
            throw error;
        }
    },
};

module.exports = documentParserClient;
