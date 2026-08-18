/**
 * Local-dev stand-in for Google Document AI. Does no real OCR/layout parsing —
 * it decodes text-ish buffers as UTF-8 so the pipeline runs end-to-end without
 * GCP credentials. Binary formats (PDF/image) will decode to garbage text;
 * that's expected here, it's only meant to exercise the pipeline shape.
 */
const mockDocumentParserClient = {
    async parse({ buffer, mimeType, fileName } = {}) {
        if (!buffer || buffer.length === 0) {
            return { text: '', provider: 'mock' };
        }

        const text = buffer.toString('utf-8').slice(0, 20000);

        return {
            text,
            provider: 'mock',
            meta: { mimeType: mimeType || null, fileName: fileName || null, byteLength: buffer.length }
        };
    }
};

module.exports = mockDocumentParserClient;
