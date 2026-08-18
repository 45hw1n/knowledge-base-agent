/**
 * Parses and validates the LLM's raw JSON response into a normalized list of
 * candidate entities. Never throws on malformed input — the orchestrator
 * treats a failure here as "no entities extracted", marks the email's
 * processing outcome accordingly, and logs the parse failure for debugging.
 */
function postProcess(rawResponse) {
    let parsed;
    try {
        // Strip accidental markdown code fences some providers add despite instructions.
        const cleaned = String(rawResponse).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
        parsed = JSON.parse(cleaned);
    } catch (error) {
        return { entities: [], error: `Failed to parse AI response as JSON: ${error.message}` };
    }

    if (!parsed || !Array.isArray(parsed.entities)) {
        return { entities: [], error: 'AI response missing an "entities" array' };
    }

    const entities = [];
    for (const candidate of parsed.entities) {
        if (!candidate || typeof candidate !== 'object') continue;

        const entityType = typeof candidate.entityType === 'string' ? candidate.entityType.trim() : '';
        const data = candidate.data && typeof candidate.data === 'object' ? candidate.data : null;

        if (!entityType || !data) {
            console.warn('[extractEntities] Skipping malformed entity candidate:', candidate);
            continue;
        }

        const confidence = typeof candidate.confidence === 'number'
            ? Math.min(Math.max(candidate.confidence, 0), 1)
            : null;

        entities.push({ entityType, data, confidence });
    }

    return { entities, error: null };
}

module.exports = { postProcess };
