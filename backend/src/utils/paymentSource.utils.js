const mongoose = require('mongoose');
const CreditCard = require('../models/CreditCard');
const BankAccount = require('../models/BankAccount');

const KIND_TO_REF_MODEL = {
    CREDIT_CARD: 'CreditCard',
    BANK_ACCOUNT: 'BankAccount'
};

/**
 * Normalize payment source input to PaymentInstrumentSchema shape.
 *
 * @param {{ kind: string, instrumentId: string|ObjectId, refModel?: string }|null|undefined} ps
 * @returns {{ kind: string, refModel: string, instrumentId: ObjectId }|null}
 */
function normalizePaymentSource(ps) {
    if (!ps?.kind || !ps?.instrumentId) {
        return null;
    }

    const refModel = ps.refModel || KIND_TO_REF_MODEL[ps.kind];
    if (!refModel) {
        throw new Error(`Invalid payment source kind: ${ps.kind}`);
    }

    return {
        kind: ps.kind,
        refModel,
        instrumentId: new mongoose.Types.ObjectId(ps.instrumentId)
    };
}

/**
 * Batch-fetch credit card and bank account details for all paymentSource
 * references on the given documents. Returns a Map keyed by instrumentId string
 * with `{ displayName, last4, bank }` payloads suitable for UI rendering.
 *
 * @param {Array<{ paymentSource?: { kind?: string, instrumentId?: any } }>} docs
 * @returns {Promise<Map<string, { displayName: string, last4: string, bank: string }>>}
 */
async function buildInstrumentMap(docs) {
    const creditCardIds = [];
    const bankAccountIds = [];

    for (const doc of docs) {
        const ps = doc.paymentSource;
        if (!ps?.instrumentId) continue;
        if (ps.kind === 'CREDIT_CARD') {
            creditCardIds.push(ps.instrumentId);
        } else if (ps.kind === 'BANK_ACCOUNT') {
            bankAccountIds.push(ps.instrumentId);
        }
    }

    const [creditCards, bankAccounts] = await Promise.all([
        creditCardIds.length > 0
            ? CreditCard.find({ _id: { $in: creditCardIds } }, { name: 1, bank: 1, last4: 1 }).lean()
            : Promise.resolve([]),
        bankAccountIds.length > 0
            ? BankAccount.find({ _id: { $in: bankAccountIds } }, { name: 1, bank: 1, last4: 1 }).lean()
            : Promise.resolve([])
    ]);

    const map = new Map();
    for (const cc of creditCards) {
        map.set(cc._id.toString(), { displayName: cc.name, last4: cc.last4, bank: cc.bank });
    }
    for (const ba of bankAccounts) {
        map.set(ba._id.toString(), { displayName: ba.name, last4: ba.last4, bank: ba.bank });
    }
    return map;
}

module.exports = {
    normalizePaymentSource,
    buildInstrumentMap,
    KIND_TO_REF_MODEL
};
