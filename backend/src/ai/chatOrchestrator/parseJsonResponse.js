/**
 * Parses an AI response expected to be a JSON object, stripping markdown
 * code fences first — same convention as
 * ai/orchestrator/structuredExtraction.js's parseStructuredResponse(), just
 * without that function's INVOICE/TICKET-specific `found: false` sentinel
 * (chat's two AI calls don't use that envelope shape).
 *
 * @param {string} rawResponse
 * @returns {{ data: object|null, error: string|null }}
 */
function parseJsonResponse(rawResponse) {
  let parsed;
  try {
    const cleaned = String(rawResponse).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (error) {
    return { data: null, error: `Failed to parse AI response as JSON: ${error.message}` };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { data: null, error: 'AI response is not a JSON object' };
  }

  return { data: parsed, error: null };
}

module.exports = { parseJsonResponse };
