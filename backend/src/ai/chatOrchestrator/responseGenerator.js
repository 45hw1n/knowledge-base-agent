const aiClient = require('../client');
const { buildResponsePrompt } = require('./prompts/responsePrompt');
const { parseJsonResponse } = require('./parseJsonResponse');

/**
 * aiClient call #2 of 2 — turns already-retrieved data into a concise,
 * human-readable answer plus a `sources[]` array. The AI is only ever asked
 * to reference results by `displayId`; every referenced displayId is
 * validated against the actual retrieved rows here and dropped if it
 * doesn't match — the AI never gets to invent an `entityId` that wasn't
 * really retrieved. See decisions.md.
 *
 * @param {object} params
 * @param {string} params.input
 * @param {Record<string, Array<object>>} params.retrievedData - keyed by data source
 * @returns {Promise<{ message: string|null, sources: Array<object>, error: string|null }>}
 */
async function generateResponse({ input, retrievedData }) {
  const allRows = Object.values(retrievedData).flat();
  const rowsByDisplayId = new Map(allRows.map((row) => [row.displayId, row]));

  const prompt = buildResponsePrompt({ input, retrievedData });

  let raw;
  try {
    raw = await aiClient.generate(prompt, { feature: 'chatResponse' });
  } catch (error) {
    return { message: null, sources: [], error: error.message };
  }

  const { data: parsed, error: parseError } = parseJsonResponse(raw);
  if (parseError) {
    return { message: null, sources: [], error: parseError };
  }

  const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
  if (!message) {
    return { message: null, sources: [], error: 'Response generation produced an empty message' };
  }

  const referencedDisplayIds = Array.isArray(parsed.referencedDisplayIds) ? parsed.referencedDisplayIds : [];
  const sources = referencedDisplayIds
    .map((displayId) => rowsByDisplayId.get(displayId))
    .filter(Boolean)
    .map((row) => ({ entityId: row.entityId, displayId: row.displayId, title: row.title, type: row.type }));

  return { message, sources, error: null };
}

module.exports = { generateResponse };
