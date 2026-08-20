const gmailService = require('../../services/gmailService');
const documentParserClient = require('../../documentParsing/client');
const { runStructuredExtraction } = require('./structuredExtraction');

/**
 * Merges structured extraction results from multiple attachments on the
 * same email into one object. A field present on only one attachment wins
 * outright; a field where attachments disagree is logged as a conflict and
 * resolved by first-non-null-wins rather than silently overwritten or
 * rejecting the whole email — matches the existing "warn, don't reject"
 * convention used elsewhere in this codebase (e.g. Document.js's summary
 * word-count check).
 *
 * @param {Array<object>} results - non-null structured-extraction outputs, one per attachment
 * @returns {object|null}
 */
function mergeAcrossAttachments(results) {
    if (!results || results.length === 0) return null;
    if (results.length === 1) return results[0];

    const merged = {};
    const keys = new Set(results.flatMap((r) => Object.keys(r)));

    for (const key of keys) {
        const values = results.map((r) => r[key]).filter((v) => v !== null && v !== undefined);
        if (values.length === 0) {
            merged[key] = null;
            continue;
        }

        const [first, ...rest] = values;
        const allAgree = rest.every((v) => JSON.stringify(v) === JSON.stringify(first));
        if (!allAgree) {
            console.warn(
                `[documentProcessor] Conflicting "${key}" across attachments — using the first value found.`,
                values
            );
        }
        merged[key] = first;
    }

    return merged;
}

/**
 * Runs type-specific structured extraction over every attachment on an
 * email and reconciles the results into one object. Returns null (not an
 * error) when there are no attachments, or none of them yielded usable
 * data — the caller (ai/orchestrator/index.js) treats that as "fall back to
 * extracting from the email body directly."
 *
 * @param {object} params
 * @param {import('mongoose').Document} params.emailDoc - an EmailToProcess record
 * @param {string} params.type - one of Entity.ENTITY_TYPES
 * @returns {Promise<object|null>}
 */
async function runDocumentProcessor({ emailDoc, type }) {
    const attachments = emailDoc.attachments || [];
    if (attachments.length === 0) return null;

    const results = [];

    for (const attachment of attachments) {
        try {
            const buffer = await gmailService.fetchAttachment(
                emailDoc.accountUserId,
                emailDoc.messageId,
                attachment.attachmentId
            );
            const parsed = await documentParserClient.parse({
                buffer,
                mimeType: attachment.mimeType,
                fileName: attachment.filename,
            });

            if (!parsed.text) continue;

            const { data, error } = await runStructuredExtraction(parsed.text, type);
            if (error) {
                console.error(`[documentProcessor] Extraction failed for attachment "${attachment.filename}": ${error}`);
                continue;
            }
            if (data) results.push(data);
        } catch (error) {
            console.error(
                `[documentProcessor] Failed to fetch/parse attachment "${attachment.filename}" (${attachment.attachmentId}):`,
                error.message
            );
        }
    }

    return mergeAcrossAttachments(results);
}

module.exports = { runDocumentProcessor, mergeAcrossAttachments };
