const { GoogleGenAI } = require('@google/genai');

const DEFAULT_MODEL = 'models/gemini-2.5-flash';

// Lazily constructed — this file is required unconditionally by ai/client/index.js
// alongside every other provider, so it must not throw unless it's actually used.
let genAI;
function getClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is missing from environment variables');
    }
    if (!genAI) {
        genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return genAI;
}

const geminiClient = {
    async generate(prompt, options = {}) {
        const modelName = options.model || DEFAULT_MODEL;
        try {
            const response = await getClient().models.generateContent({
                model: modelName,
                contents: prompt,
            });

            if (!response || !response.text) {
                throw new Error('Empty response from Gemini');
            }

            return response.text.trim();
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    },
};

module.exports = geminiClient;