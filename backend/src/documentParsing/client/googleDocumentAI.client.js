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
const fs = require('fs');

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

/**
 * Startup check — confirms the credentials file is present and that it can
 * actually authenticate to Google's APIs. Deliberately does NOT call a
 * Document AI resource method (e.g. getProcessor): the service account is
 * scoped to the minimal "Document AI API User" role for processDocument
 * only, which excludes resource-read permissions like processors.get.
 * Called once from server.js when DOCUMENT_PARSER_PROVIDER=google-document-ai;
 * failures are logged but non-fatal so the mock provider path stays usable.
 */
async function verifyConnection() {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!keyPath || !fs.existsSync(keyPath)) {
        console.error(`[Document AI] Credentials file not found at "${keyPath}"`);
        return false;
    }
    console.log(`[Document AI] Credentials file detected at "${keyPath}"`);

    try {
        getProcessorName(); // validates DOCUMENT_AI_* env vars are set

        // Uses google-auth-library directly (not the Document AI client's
        // internal auth) because it needs an explicit scope to mint a token —
        // the Document AI client only attaches scopes when calling an actual
        // RPC method, which we're avoiding here (see comment above).
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const authClient = await auth.getClient();
        const { token } = await authClient.getAccessToken();
        if (!token) throw new Error('No access token returned');

        console.log('[Document AI] Credentials authenticated successfully with Google Cloud.');
        return true;
    } catch (error) {
        console.error('[Document AI] Connection check failed:', error.message);
        return false;
    }
}

const googleDocumentAIClient = {
    verifyConnection,

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
