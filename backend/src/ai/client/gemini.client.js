const { GoogleGenAI } = require('@google/genai');

const DEFAULT_MODEL = 'models/gemini-2.5-flash';

if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing from environment variables');
}

const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const geminiClient = {
    async generate(prompt, options = {}) {
        const modelName = options.model || DEFAULT_MODEL;
        try {
            const response = await genAI.models.generateContent({
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