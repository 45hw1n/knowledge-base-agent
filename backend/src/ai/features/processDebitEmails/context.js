const mongoose = require('mongoose');
const DebitEmailToProcess = require('../../../models/DebitEmailToProcess');
const Field = require('../../../models/Field');
const BankAccount = require('../../../models/BankAccount');
const CreditCard = require('../../../models/CreditCard');
const { decryptClearText } = require('../../../utils/emailEncryption');

/**
 * Context Builder: processDebitEmails
 * Fetches and structures data required for the LLM prompt.
 */
const contextBuilder = {
    /**
     * Fetches shared/static data that is identical across all emails for a user.
     * Call once per batch, then pass the result to build() for each email.
     * @param {string} accountUserId - The user ID.
     * @returns {Promise<Object>} - { categories, subCategories, paymentSources }
     */
    async fetchSharedData(accountUserId) {
        console.log(`[Context Builder] Fetching shared data for user ${accountUserId}...`);

        const [fields, bankAccounts, creditCards] = await Promise.all([
            Field.find({
                name: { $in: ['category', 'subCategory'] },
                isActive: true
            }).lean(),
            BankAccount.find({ userId: accountUserId, isActive: true }).lean(),
            CreditCard.find({ userId: accountUserId, isActive: true }).lean()
        ]);

        const categoryField = fields.find(f => f.name === 'category');
        const subCategoryField = fields.find(f => f.name === 'subCategory');

        const categoriesMap = {};

        if (categoryField && categoryField.values) {
            categoryField.values.forEach(cat => {
                if (cat.isActive) {
                    categoriesMap[cat.id] = {
                        id: cat.id,
                        label: cat.label,
                        subCategories: []
                    };
                }
            });
        }

        if (subCategoryField && subCategoryField.values) {
            subCategoryField.values.forEach(sub => {
                if (sub.isActive && sub.nestedTo && sub.nestedTo.valueId) {
                    const parentId = sub.nestedTo.valueId;
                    if (categoriesMap[parentId]) {
                        categoriesMap[parentId].subCategories.push({
                            id: sub.id,
                            label: sub.label
                        });
                    }
                }
            });
        }

        const categories = Object.values(categoriesMap);
        const subCategories = Object.values(categoriesMap).flatMap(category =>
            category.subCategories.map(sub => ({
                id: sub.id,
                label: sub.label,
                categoryId: category.id
            }))
        );

        const paymentSources = [
            ...bankAccounts.map(b => ({
                id: b._id.toString(),
                type: 'BANK_ACCOUNT',
                bank: b.bank,
                last4: b.last4,
                upiIds: b.upiIds || [],
                debitCardLast4s: (b.debitCards || []).map(d => d.last4)
            })),
            ...creditCards.map(c => ({
                id: c._id.toString(),
                type: 'CREDIT_CARD',
                bank: c.bank,
                last4: c.last4,
                billingCycleDay: c.billingCycleDay
            }))
        ];

        return { categories, subCategories, paymentSources };
    },

    /**
     * Builds the context object for a single debit email.
     * @param {string} emailId - The ID or messageId of the email.
     * @param {string} accountUserId - The user ID.
     * @param {Object} [sharedData] - Pre-fetched shared data from fetchSharedData().
     *   If omitted, shared data is fetched from the database (backward compatible).
     * @returns {Promise<Object>} - The structured context object.
     */
    async build(emailId, accountUserId, sharedData) {
        console.log(`[Context Builder] Building context for email ${emailId} and user ${accountUserId}...`);

        const { categories, subCategories, paymentSources } = sharedData
            || await this.fetchSharedData(accountUserId);

        // 1. Fetch Debit Email From Database
        const isObjectId = mongoose.Types.ObjectId.isValid(emailId);
        const query = isObjectId
            ? { $or: [{ _id: emailId }, { messageId: emailId }], accountUserId }
            : { messageId: emailId, accountUserId };

        const emailDoc = await DebitEmailToProcess.findOne(query).lean();

        if (!emailDoc) {
            throw new Error(`Email not found: ${emailId}`);
        }

        function safeDecrypt(value) {
            if (!value) return value;
            if (typeof value === "string") return value;
            if (value.iv && value.content && value.tag) {
                try {
                    return decryptClearText(value);
                } catch (err) {
                    return null;
                }
            }
            return value;
        }

        const { messageId, threadId, encryptedCleanText } = emailDoc;
        const from = safeDecrypt(emailDoc.from);
        const subject = safeDecrypt(emailDoc.subject);
        const snippet = safeDecrypt(emailDoc.snippet);
        const date = emailDoc.date;

        // 2. Decrypt Email Content
        let content = snippet || "";
        if (encryptedCleanText) {
            try {
                console.log(`[Context Builder] Decrypting email ${messageId}...`);
                content = decryptClearText(encryptedCleanText) || content;
            } catch (err) {
                console.error(`[Context Builder] Decryption failed for email ${messageId}:`, err);
            }
        }

        // 3. Construct Final Context Object
        return {
            email: {
                messageId,
                threadId,
                from,
                subject,
                date,
                content
            },
            emailMetadata: {
                messageId,
                threadId,
                from,
                subject,
                date
            },
            emailContent: content,
            categories,
            subCategories,
            paymentSources
        };
    }
};

module.exports = contextBuilder;
