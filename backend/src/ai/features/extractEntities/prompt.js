const EXAMPLE_ENTITY_TYPES = [
    'contact', 'invoice', 'receipt', 'order', 'appointment', 'ticket', 'shipment'
];

/**
 * Builds the extraction prompt from a context object (see context.js).
 * The entity type set is NOT a fixed enum — the model proposes whatever
 * type(s) fit the content. The example list below only primes it with
 * plausible categories for the initial demo; it is not exhaustive and the
 * model may return any other type string it judges appropriate.
 */
function buildExtractionPrompt(context) {
    const { subject, from, bodyText, attachmentSections = [] } = context;

    const attachmentBlocks = attachmentSections
        .filter((section) => section.text)
        .map((section) => `--- Attachment: ${section.filename} ---\n${section.text}`)
        .join('\n\n');

    return `You are a knowledge-base extraction assistant. Read the email (and any attached
document content) below and identify every distinct real-world entity described in it
— e.g. ${EXAMPLE_ENTITY_TYPES.join(', ')}, or any other type that genuinely fits the
content. Do not force content into one of the example types if none fits; propose your
own concise, lowercase, snake_case type name instead.

For each entity found, extract its meaningful structured fields as a flat JSON object.
Only extract information that is actually present in the content — never invent values.
If nothing worth extracting is present, return an empty entities array.

Respond with ONLY valid JSON in exactly this shape, no prose, no markdown fences:
{
  "entities": [
    { "entityType": "string", "data": { <field>: <value>, ... }, "confidence": <0-1 number> }
  ]
}

Email subject: ${subject || '(none)'}
Email from: ${from || '(unknown)'}

Email body:
${bodyText || '(empty)'}
${attachmentBlocks ? `\n${attachmentBlocks}` : ''}`;
}

module.exports = { buildExtractionPrompt, EXAMPLE_ENTITY_TYPES };
