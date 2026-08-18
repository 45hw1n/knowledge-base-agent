const { decryptClearText } = require('../../../utils/emailEncryption');
const gmailService = require('../../../services/gmailService');
const documentParserClient = require('../../../documentParsing/client');

function decryptMaybe(field) {
    if (!field) return null;
    try {
        return decryptClearText(field);
    } catch (error) {
        console.error('[extractEntities] Failed to decrypt email field:', error.message);
        return null;
    }
}

/**
 * Builds the raw content this email/document contributes to extraction:
 * the cleaned email body text, plus the parsed text of every attachment
 * (routed through the document parser — Document AI or its mock).
 *
 * Handles emails with or without attachments per the extraction flow's
 * requirement — a bare email body is valid input on its own.
 */
async function buildContext(emailDoc) {
    const subject = decryptMaybe(emailDoc.subject);
    const from = decryptMaybe(emailDoc.from);
    const bodyText = decryptMaybe(emailDoc.encryptedCleanText) || '';

    const attachmentSections = [];
    for (const attachment of emailDoc.attachments || []) {
        try {
            const buffer = await gmailService.fetchAttachment(
                emailDoc.accountUserId,
                emailDoc.messageId,
                attachment.attachmentId
            );
            const parsed = await documentParserClient.parse({
                buffer,
                mimeType: attachment.mimeType,
                fileName: attachment.filename
            });
            attachmentSections.push({
                attachmentId: attachment.attachmentId,
                filename: attachment.filename,
                text: parsed.text || ''
            });
        } catch (error) {
            console.error(
                `[extractEntities] Failed to parse attachment ${attachment.filename} (${attachment.attachmentId}):`,
                error.message
            );
            attachmentSections.push({
                attachmentId: attachment.attachmentId,
                filename: attachment.filename,
                text: '',
                error: error.message
            });
        }
    }

    return {
        subject,
        from,
        bodyText,
        attachmentSections,
        hasAttachments: attachmentSections.length > 0
    };
}

module.exports = { buildContext };
