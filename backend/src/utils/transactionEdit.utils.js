const CreditCard = require('../models/CreditCard');
const BankAccount = require('../models/BankAccount');
const { normalizePaymentSource } = require('./paymentSource.utils');

class TransactionEditError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

/**
 * Verify payment instrument belongs to the user.
 */
async function verifyPaymentSourceOwnership(userId, paymentSource) {
    if (!paymentSource) return;

    const { refModel, instrumentId } = paymentSource;
    const Model = refModel === 'CreditCard' ? CreditCard : BankAccount;
    const owned = await Model.findOne({ _id: instrumentId, userId }).lean();

    if (!owned) {
        throw new TransactionEditError(
            'VALIDATION_ERROR',
            'Payment instrument not found or does not belong to user'
        );
    }
}

function pickFieldValue(field) {
    if (!field || typeof field !== 'object') return undefined;
    return {
        id: field.id ?? undefined,
        value: field.value ?? undefined,
        label: field.label ?? undefined
    };
}

/**
 * Build a $set payload for Transaction from UI changes.
 *
 * @param {Object} txn - Existing transaction (plain or mongoose)
 * @param {string|ObjectId} userId
 * @param {Object} changes
 * @returns {Promise<Object>} Fields to $set on Transaction
 */
async function buildTransactionUpdateFromChanges(txn, userId, changes = {}) {
    const base = txn.toObject ? txn.toObject() : { ...txn };
    const updateData = {};

    if (changes.name !== undefined) {
        updateData.name = changes.name;
    }
    if (changes.notes !== undefined) {
        updateData.notes = changes.notes;
    }
    if (changes.date !== undefined) {
        updateData.date = new Date(changes.date);
    }
    if (changes.cycle !== undefined) {
        updateData.cycle = changes.cycle;
    }
    if (changes.amount !== undefined) {
        updateData.amount = changes.amount;
    }
    if (changes.paymentMode !== undefined) {
        updateData.paymentMode = changes.paymentMode;
    }

    let effectivePaymentSource = base.paymentSource;
    if (changes.paymentSource !== undefined) {
        effectivePaymentSource = normalizePaymentSource(changes.paymentSource);
        if (effectivePaymentSource) {
            updateData.paymentSource = effectivePaymentSource;
        }
    }

    const resolvedPaymentSource = normalizePaymentSource(
        changes.paymentSource !== undefined ? changes.paymentSource : effectivePaymentSource
    );

    if (resolvedPaymentSource) {
        await verifyPaymentSourceOwnership(userId, resolvedPaymentSource);
    }

    const effectiveCategory =
        changes.category !== undefined
            ? pickFieldValue(changes.category)
            : base.category;
    const effectiveSubCategory =
        changes.subCategory !== undefined
            ? pickFieldValue(changes.subCategory)
            : base.subCategory;

    if (changes.category !== undefined) {
        updateData.category = effectiveCategory ?? null;
    }
    if (changes.subCategory !== undefined) {
        updateData.subCategory = effectiveSubCategory ?? null;
    }

    const isRepayment =
        changes.isCreditCardRepayment !== undefined
            ? changes.isCreditCardRepayment
            : base.isCreditCardRepayment ?? false;

    if (changes.isCreditCardRepayment !== undefined) {
        updateData.isCreditCardRepayment = isRepayment;
    }

    if (changes.isPrivate !== undefined) {
        updateData.isPrivate = changes.isPrivate;
    }

    const type = base.type;
    const hasCategory =
        (changes.category !== undefined ? effectiveCategory : base.category) &&
        ((changes.category !== undefined ? effectiveCategory : base.category).id ||
            (changes.category !== undefined ? effectiveCategory : base.category).value);
    const hasSubCategory =
        (changes.subCategory !== undefined ? effectiveSubCategory : base.subCategory) &&
        ((changes.subCategory !== undefined ? effectiveSubCategory : base.subCategory).id ||
            (changes.subCategory !== undefined ? effectiveSubCategory : base.subCategory).value);

    if (type === 'DEBIT' && !isRepayment && (!hasCategory || !hasSubCategory)) {
        throw new TransactionEditError(
            'VALIDATION_ERROR',
            'DEBIT transactions require category and subCategory'
        );
    }

    return updateData;
}

module.exports = {
    TransactionEditError,
    verifyPaymentSourceOwnership,
    buildTransactionUpdateFromChanges,
    pickFieldValue
};
