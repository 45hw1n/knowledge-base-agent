const aiClient = require('../../client');
const contextBuilder = require('./context');
const promptBuilder = require('./prompt');
const postProcessor = require('./postProcessor');
const repository = require('./repository');

function parseAIResponse(aiResponseRaw) {
    if (typeof aiResponseRaw !== 'string') {
        return aiResponseRaw;
    }

    const cleanJson = aiResponseRaw.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
}

function buildReferenceData(context) {
    return {
        categories: context.categories.map(category => ({
            _id: category.id,
            code: category.id,
            name: category.label
        })),
        subCategories: context.subCategories.map(subCategory => ({
            _id: subCategory.id,
            code: subCategory.id,
            name: subCategory.label,
            categoryId: subCategory.categoryId
        })),
        paymentSources: context.paymentSources.map(paymentSource => ({
            _id: paymentSource.id,
            type: paymentSource.type,
            last4: paymentSource.last4,
            bank: paymentSource.bank,
            upiIds: paymentSource.upiIds,
            debitCardLast4s: paymentSource.debitCardLast4s,
            billingCycleDay: paymentSource.billingCycleDay
        }))
    };
}

/**
 * Orchestrator: processDebitEmails
 * Coordinates the AI workflow for processing debit emails.
 */
const orchestrator = {
    async execute(emailData, sharedData) {
        console.log('[Orchestrator] Starting processDebitEmails workflow...');

        // 1. Build Context
        const context = await contextBuilder.build(emailData.emailId, emailData.accountUserId, sharedData);

        // 2. Generate Prompt
        const prompt = promptBuilder.generate(context);

        // 3. Call AI Client
        const aiResponseRaw = await aiClient.generate(prompt);
        const aiResponse = parseAIResponse(aiResponseRaw);

        // 4. Post-process AI Output
        const processedResult = await postProcessor.processAITransaction({
            aiData: aiResponse,
            userId: emailData.accountUserId,
            messageId: context.email.messageId,
            threadId: emailData.threadId || context.email.threadId,
            referenceData: buildReferenceData(context)
        });

        // 5. Persist Results
        const savedResult = await repository.save(processedResult);

        return savedResult;
    },
};

module.exports = orchestrator;
