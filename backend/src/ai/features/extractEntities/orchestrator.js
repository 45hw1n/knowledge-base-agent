const aiClient = require('../../client');
const { buildContext } = require('./context');
const { buildExtractionPrompt } = require('./prompt');
const { postProcess } = require('./postProcessor');
const { persistEntities } = require('./repository');

/**
 * Generic document/entity-extraction pipeline (replaces the old
 * transaction-only processDebitEmails orchestrator):
 *
 *   emailDoc → context (decrypt body + parse any attachments via
 *   Document AI) → prompt → LLM → postProcess → persist to MongoDB
 *
 * Works for an email with no attachments (body text only), an email with
 * one or more attachments, or a mix — buildContext handles both.
 *
 * @param {import('mongoose').Document} emailDoc - a DebitEmailToProcess record
 * @returns {{ entitiesCreated: number, error: string|null }}
 */
async function extractEntitiesFromEmail(emailDoc) {
    const context = await buildContext(emailDoc);
    const prompt = buildExtractionPrompt(context);

    const aiResponse = await aiClient.generate(prompt, { feature: 'extractEntities' });
    const { entities, error } = postProcess(aiResponse);

    if (error) {
        console.error(`[extractEntities] messageId=${emailDoc.messageId} postprocess error: ${error}`);
        return { entitiesCreated: 0, error };
    }

    const sourceType = context.hasAttachments ? 'EMAIL_ATTACHMENT' : 'EMAIL_BODY';
    const created = await persistEntities({
        userId: emailDoc.accountUserId,
        sourceEmailId: emailDoc._id,
        sourceType,
        rawTextSnippet: context.bodyText,
        entities
    });

    return { entitiesCreated: created.length, error: null };
}

module.exports = { extractEntitiesFromEmail };
