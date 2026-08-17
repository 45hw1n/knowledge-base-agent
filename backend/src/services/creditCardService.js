const mongoose = require('mongoose');
const CreditCard = require('../models/CreditCard');
const BankAccount = require('../models/BankAccount');

const throwError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    throw error;
};

const validateObjectId = (id, fieldName = 'ID') => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throwError('INVALID_OBJECT_ID', `Invalid ${fieldName} format`);
    }
};

/**
 * Normalizes a lean Mongoose document by mapping `_id` to `id` and removing internal fields.
 * Required because .lean() bypasses Mongoose schema transforms.
 */
const normalizeLean = (doc) => {
    if (!doc) return doc;
    const { _id, __v, ...rest } = doc;
    return { id: _id.toString(), ...rest };
};

const normalizePayload = (payload) => {
    const normalized = { ...payload };

    if (normalized.name !== undefined) {
        normalized.name = normalized.name.trim();
        if (normalized.name === '') normalized.name = null;
    }
    if (normalized.bank !== undefined) {
        normalized.bank = normalized.bank.trim();
        if (normalized.bank === '') normalized.bank = null;
    }
    if (normalized.last4 !== undefined) {
        normalized.last4 = normalized.last4.trim();
    }
    if (normalized.network !== undefined) {
        if (normalized.network) {
            normalized.network = normalized.network.trim().toUpperCase();
        } else {
            normalized.network = null;
        }
    }

    if (normalized.dueDateDay && normalized.billingCycleDay) {
        if (normalized.dueDateDay < normalized.billingCycleDay) {
            console.warn(`[WARNING] Due date (${normalized.dueDateDay}) is before billing cycle day (${normalized.billingCycleDay}). Assuming wrap-around.`);
        }
    }

    return normalized;
};

const validateBankLinkage = async (userId, linkedBankAccountId) => {
    if (linkedBankAccountId === null) return; // Allow unlinking
    
    validateObjectId(linkedBankAccountId, 'linkedBankAccountId');

    const validBank = await BankAccount.exists({ 
        _id: linkedBankAccountId, 
        userId, 
        isActive: true 
    });
    
    if (!validBank) {
        throwError('INVALID_BANK_LINKAGE', 'Linked bank account not found or is inactive');
    }
};

const createCreditCard = async (userId, payload) => {
    validateObjectId(userId, 'userId');

    const normalized = normalizePayload(payload);

    if (normalized.linkedBankAccountId !== undefined) {
        await validateBankLinkage(userId, normalized.linkedBankAccountId);
    }

    try {
        const creditCard = await CreditCard.create({
            ...normalized,
            userId,
            isActive: true
        });

        // Compute isExpired flag dynamically
        const cardObj = creditCard.toObject();
        const now = new Date();
        cardObj.isExpired = (cardObj.expiryYear < now.getFullYear()) || 
            (cardObj.expiryYear === now.getFullYear() && cardObj.expiryMonth < (now.getMonth() + 1));

        return cardObj;
    } catch (error) {
        if (error.code === 11000) {
            throwError('DUPLICATE_KEY', 'A credit card with the same last4 and bank already exists for this user.');
        }
        throw error;
    }
};

const updateCreditCard = async (userId, creditCardId, payload) => {
    validateObjectId(userId, 'userId');
    validateObjectId(creditCardId, 'creditCardId');

    const normalized = normalizePayload(payload);

    if (normalized.linkedBankAccountId !== undefined) {
        await validateBankLinkage(userId, normalized.linkedBankAccountId);
    }

    try {
        const updatedCard = await CreditCard.findOneAndUpdate(
            { _id: creditCardId, userId, isActive: true },
            { $set: normalized },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedCard) {
            throwError('CREDIT_CARD_NOT_FOUND', 'Credit card not found or inactive');
        }

        const now = new Date();
        updatedCard.isExpired = (updatedCard.expiryYear < now.getFullYear()) || 
            (updatedCard.expiryYear === now.getFullYear() && updatedCard.expiryMonth < (now.getMonth() + 1));

        return normalizeLean(updatedCard);
    } catch (error) {
        if (error.code === 11000) {
            throwError('DUPLICATE_KEY', 'Update would cause a duplicate credit card (same bank and last4).');
        }
        if (!error.code) error.code = 'UPDATE_FAILED';
        throw error;
    }
};

const deleteCreditCard = async (userId, creditCardId) => {
    validateObjectId(userId, 'userId');
    validateObjectId(creditCardId, 'creditCardId');

    const deletedCard = await CreditCard.findOneAndUpdate(
        { _id: creditCardId, userId, isActive: true },
        { $set: { isActive: false } },
        { new: true }
    ).lean();

    if (!deletedCard) {
        throwError('CREDIT_CARD_NOT_FOUND', 'Credit card not found or already inactive');
    }

    return normalizeLean(deletedCard);
};

const getCreditCards = async (userId) => {
    validateObjectId(userId, 'userId');

    const cards = await CreditCard.find({ userId, isActive: true })
        .sort({ createdAt: -1 })
        .lean();

    const now = new Date();
    return cards.map(c => normalizeLean({
        ...c,
        isExpired: (c.expiryYear < now.getFullYear()) || (c.expiryYear === now.getFullYear() && c.expiryMonth < (now.getMonth() + 1))
    }));
};

const getCreditCardById = async (userId, creditCardId) => {
    validateObjectId(userId, 'userId');
    validateObjectId(creditCardId, 'creditCardId');

    const card = await CreditCard.findOne({ _id: creditCardId, userId, isActive: true }).lean();
    
    if (!card) {
        throwError('CREDIT_CARD_NOT_FOUND', 'Credit card not found');
    }

    const now = new Date();
    card.isExpired = (card.expiryYear < now.getFullYear()) || (card.expiryYear === now.getFullYear() && card.expiryMonth < (now.getMonth() + 1));

    return normalizeLean(card);
};

module.exports = {
    createCreditCard,
    updateCreditCard,
    deleteCreditCard,
    getCreditCards,
    getCreditCardById
};
