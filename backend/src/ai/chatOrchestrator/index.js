const aiClient = require('../client');
const { buildIntentPrompt } = require('./prompts/intentPrompt');
const { parseJsonResponse } = require('./parseJsonResponse');
const { validateQueries } = require('./dataSourceRegistry');
const { retrieveData } = require('./dataAccess');
const { generateResponse } = require('./responseGenerator');

const UNSUPPORTED_MESSAGE =
  "I can help with questions about your tickets, invoices, payments, events, and documents, but I don't have information to answer that yet.";

/**
 * The chat feature's own orchestration pipeline — a fully separate module
 * from `ai/orchestrator/` (the email-extraction pipeline). The two share
 * no steps beyond the `aiClient` factory: extraction turns one email into
 * one new entity (classify -> per-type prompt -> validate -> persist);
 * chat turns a question into an answer (classify intent -> whitelist
 * validate -> multi-source READ -> synthesize). Reusing extraction's
 * dispatch tables would conflate two different meanings of the same-looking
 * string ("TICKET" as a classifier candidate vs. as a chat data-source
 * enum value). See decisions.md.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {string} params.input
 * @param {Array<{role:string, content:string}>} [params.history] - only for existing-conversation turns
 * @returns {Promise<{ message: string|null, sources: Array<object>, error: {code:string, message:string}|null }>}
 */
async function orchestrateChatTurn({ userId, input, history = [] }) {
  // Computed once per turn, here — never as a module-level constant inside
  // a prompt-builder file, which would go stale for a long-running server
  // process and silently reintroduce the "LLM can't resolve 'today'" bug.
  const now = new Date();

  // Step 1 — intent extraction (aiClient call #1 of 2)
  const intentPrompt = buildIntentPrompt({ input, history, now });

  let rawIntent;
  try {
    rawIntent = await aiClient.generate(intentPrompt, { feature: 'chatIntent' });
  } catch (error) {
    return { message: null, sources: [], error: { code: 'ORCHESTRATION_FAILED', message: error.message } };
  }

  const { data: parsedIntent, error: parseError } = parseJsonResponse(rawIntent);
  if (parseError) {
    return { message: null, sources: [], error: { code: 'ORCHESTRATION_FAILED', message: parseError } };
  }

  const { data: intentData, error: validationError } = validateQueries(parsedIntent);
  if (validationError) {
    return { message: null, sources: [], error: { code: 'INVALID_QUERY', message: validationError } };
  }

  // An empty queries array (out-of-scope question, or every entry was
  // stripped by whitelisting) resolves to a graceful COMPLETED message —
  // never a FAILED error — and skips retrieval/response-generation
  // entirely.
  if (intentData.queries.length === 0) {
    return { message: UNSUPPORTED_MESSAGE, sources: [], error: null };
  }

  // Step 2 — data retrieval (each query entry carries its own filters —
  // this is what makes a cross-entity question like "Plan my day" possible
  // in one turn: today's events and open/urgent tickets are two different
  // filter sets, not one shared one)
  const { data: retrievedData, error: retrievalError } = await retrieveData({
    userId,
    queries: intentData.queries,
  });
  if (retrievalError) {
    return { message: null, sources: [], error: { code: 'DATA_RETRIEVAL_FAILED', message: retrievalError } };
  }

  const hasAnyResults = Object.values(retrievedData).some((rows) => rows.length > 0);
  if (!hasAnyResults) {
    return { message: 'I didn\'t find anything matching that.', sources: [], error: null };
  }

  // Step 3 — response generation (aiClient call #2 of 2)
  const { message, sources, error: genError } = await generateResponse({ input, retrievedData });
  if (genError) {
    return { message: null, sources: [], error: { code: 'RESPONSE_GENERATION_FAILED', message: genError } };
  }

  return { message, sources, error: null };
}

module.exports = { orchestrateChatTurn, UNSUPPORTED_MESSAGE };
