const OpenAI = require('openai');

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000;

// Lazily constructed — this file is required unconditionally by ai/client/index.js
// alongside every other provider, so it must not throw unless it's actually used.
let openai;
function getClient() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is missing from environment variables');
    }
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

function isRetryable(error) {
    return (
        error instanceof OpenAI.RateLimitError ||
        error instanceof OpenAI.InternalServerError ||
        error instanceof OpenAI.APIConnectionError
    );
}

function getRetryDelay(error, attempt) {
    const retryAfter = error.headers?.get?.('retry-after');
    if (retryAfter) {
        const parsed = Number(retryAfter);
        if (!Number.isNaN(parsed) && parsed > 0) {
            return parsed * 1000;
        }
    }
    const exponential = BASE_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    return exponential + jitter;
}

const openaiClient = {
    async generate(prompt, options = {}) {
        const model = options.model || DEFAULT_MODEL;
        let lastError;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const completion = await getClient().chat.completions.create({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a structured data extraction assistant.',
                        },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.2,
                });

                return completion.choices[0].message.content;
            } catch (error) {
                lastError = error;

                if (!isRetryable(error) || attempt === MAX_RETRIES) {
                    throw error;
                }

                const delay = getRetryDelay(error, attempt);
                console.warn(
                    `[OpenAI] Retryable error (${error.status || error.constructor.name}). ` +
                    `Attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${Math.round(delay)}ms...`
                );
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    },
};

module.exports = openaiClient;
