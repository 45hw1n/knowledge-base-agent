/**
 * Google Document AI client — OCR/layout parsing for scanned/rich documents
 * (PDFs, images, etc). Requires a configured GCP Document AI processor.
 * See backend/DOCUMENT_AI_SETUP.md for setup instructions.
 *
 * Lazily constructed, mirroring ai/client/openai.client.js and
 * gemini.client.js: this file is required unconditionally by
 * documentParsing/client/index.js alongside the mock provider, so it must
 * not throw at require-time — only when actually used without credentials.
 */
let client;
function getClient() {
    if (!client) {
        // Required lazily (not at module top-level) so this file can be safely
        // required unconditionally by documentParsing/client/index.js even when
        // the google-document-ai provider isn't the one actually in use.
        const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
        client = new DocumentProcessorServiceClient();
    }
    return client;
}

function getProcessorName() {
    const projectId = process.env.DOCUMENT_AI_PROJECT_ID;
    const location = process.env.DOCUMENT_AI_LOCATION;
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

    if (!projectId || !location || !processorId) {
        throw new Error(
            'DOCUMENT_AI_PROJECT_ID, DOCUMENT_AI_LOCATION and DOCUMENT_AI_PROCESSOR_ID must all be set to use the google-document-ai provider'
        );
    }

    return `projects/${projectId}/locations/${location}/processors/${processorId}`;
}

const googleDocumentAIClient = {
    async parse({ buffer, mimeType } = {}) {
        if (!buffer || buffer.length === 0) {
            return { text: '', provider: 'google-document-ai' };
        }

        const request = {
            name: getProcessorName(),
            rawDocument: {
                content: buffer.toString('base64'),
                mimeType: mimeType || 'application/pdf'
            }
        };

        try {
            const [result] = await getClient().processDocument(request);
            const document = result.document || {};

            return {
                text: document.text || '',
                provider: 'google-document-ai',
                meta: { pageCount: document.pages?.length ?? null }
            };
        } catch (error) {
            console.error('Document AI Error:', error);
            throw error;
        }
    }
};

module.exports = googleDocumentAIClient;
