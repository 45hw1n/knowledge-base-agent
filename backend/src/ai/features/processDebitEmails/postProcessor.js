/**
 * postProcessor.js
 * Deterministic validation layer for Fynverse AI transaction ingestion.
 */

/**
 * Normalizes raw AI output into a baseline object.
 */
function normalizeCore(aiData, userId, messageId, threadId) {
    const date = new Date(aiData.date);
    const amount = Number(aiData.amount);

    return {
        userId,
        messageId,
        threadId,
        status: 'READY_TO_REVIEW',
        date: isNaN(date.getTime()) ? null : date,
        amount: isNaN(amount) ? 0 : amount,
        currency: (aiData.currency || 'INR').trim().toUpperCase(),
        type: (aiData.type || 'DEBIT').trim().toUpperCase(),
        merchantRaw: (aiData.merchantRaw || '').trim(),
        merchantNormalized: (aiData.merchantNormalized || '').trim(),
        referenceId: (aiData.referenceId || '').toString().trim(),
        isCreditCardRepayment: isCreditCardRepaymentCheck(aiData),
        source: 'EMAIL',
        name: (aiData.name || '').trim(),
        cycle: typeof aiData.cycle === 'string' ? aiData.cycle.trim() : '',
        LLMMeta: aiData.LLMMeta || {}
    };
}

const REPAYMENT_MERCHANT_KEYWORDS = [
    'CRED', 'CREDIT CARD PAYMENT', 'CREDIT CARD BILL',
    'BILLDESK', 'CC PAYMENT', 'CCPAY'
];

const REPAYMENT_VPA_KEYWORDS = [
    'cred.club', 'creditcard', 'billpayment', 'ccpay'
];

const BANK_CC_PATTERN = /\b(HDFC|ICICI|SBI|AXIS|KOTAK|YES|IDFC|RBL|INDUSIND|BOB|CANARA|PNB|FEDERAL|UNION|HSBC|SCB|CITI|AMEX)\s+CREDIT\s+CARD\b/i;

const KNOWN_REGULAR_MERCHANTS = new Set([
    'swiggy', 'zomato', 'netflix', 'spotify', 'amazon', 'flipkart',
    'bigbasket', 'zepto', 'blinkit', 'uber', 'ola', 'rapido',
    "mcdonald's", 'kfc', "domino's", 'starbucks', 'dmart', 'medplus',
    'practo', 'groww', 'zerodha', 'bookmyshow', 'pvr', 'inox',
    'udemy', 'policybazaar', 'phonepe', 'google pay', 'paytm'
]);

/**
 * Deterministic guardrail for isCreditCardRepayment.
 * Tier 1: known repayment signals → true
 * Tier 2: known regular merchants → false (overrides LLM)
 * Tier 3: fallback to LLM value
 */
function isCreditCardRepaymentCheck(aiData) {
    const raw = (aiData.merchantRaw || '').toUpperCase();
    const normalized = (aiData.merchantNormalized || '').toUpperCase();

    // Tier 1 — Deterministic TRUE
    for (const kw of REPAYMENT_MERCHANT_KEYWORDS) {
        if (raw.includes(kw) || normalized.includes(kw)) return true;
    }

    if (BANK_CC_PATTERN.test(raw)) return true;

    const refId = (aiData.referenceId || '').toLowerCase();
    const upiId = (aiData.LLMMeta?.instrumentSignals?.upiId || '').toLowerCase();
    for (const kw of REPAYMENT_VPA_KEYWORDS) {
        if (refId.includes(kw) || upiId.includes(kw)) return true;
    }

    // Tier 2 — Deterministic FALSE
    const normalizedLower = (aiData.merchantNormalized || '').toLowerCase();
    for (const merchant of KNOWN_REGULAR_MERCHANTS) {
        if (normalizedLower.includes(merchant)) return false;
    }

    // Tier 3 — Fallback to LLM
    return aiData.isCreditCardRepayment ?? false;
}

/**
 * Resolves category from reference data.
 */
function resolveCategory(categoryId, referenceData) {
    if (!categoryId || !referenceData.categories) return null;
    const cat = referenceData.categories.find(c => c.code === categoryId || c._id.toString() === categoryId);
    return cat ? { id: cat._id.toString(), value: cat.code, label: cat.name } : null;
}

/**
 * Resolves subCategory and ensures it belongs to the parent category.
 */
function resolveSubCategory(subCategoryId, resolvedCategory, referenceData) {
    if (!subCategoryId || !resolvedCategory || !referenceData.subCategories) return null;
    const subCat = referenceData.subCategories.find(s =>
        (s.code === subCategoryId || s._id.toString() === subCategoryId) &&
        s.categoryId.toString() === resolvedCategory.id
    );
    return subCat ? { id: subCat._id.toString(), value: subCat.code, label: subCat.name } : null;
}


/**
 * Resolves payment source with fallback logic.
 * Now only resolves to CREDIT_CARD or BANK_ACCOUNT.
 * UPI IDs and debit card last4s are embedded in BankAccount.
 */
function resolvePaymentSource(aiData, referenceData) {
    const { paymentSourceId, LLMMeta } = aiData;
    const instruments = referenceData.paymentSources || [];

    // 1. Direct match by ID
    if (paymentSourceId) {
        const inst = instruments.find(i => i._id.toString() === paymentSourceId);
        if (inst) return formatInstrument(inst);
    }

    // 2. Resolve via signals
    const signals = LLMMeta?.instrumentSignals || {};

    if (signals.upiId) {
        // Find the BankAccount whose upiIds array contains this UPI ID
        const inst = instruments.find(i =>
            i.type === 'BANK_ACCOUNT' && (i.upiIds || []).includes(signals.upiId)
        );
        if (inst) return formatInstrument(inst);
    }

    if (signals.cardLast4) {
        // Check credit cards first
        const ccMatch = instruments.find(i =>
            i.type === 'CREDIT_CARD' && i.last4 === signals.cardLast4
        );
        if (ccMatch) return formatInstrument(ccMatch);

        // Then check bank accounts' embedded debit cards
        const baMatch = instruments.find(i =>
            i.type === 'BANK_ACCOUNT' && (i.debitCardLast4s || []).includes(signals.cardLast4)
        );
        if (baMatch) return formatInstrument(baMatch);
    }

    // 3. Fallback: try matching by bank account last4
    if (signals.bankAccountLast4) {
        const inst = instruments.find(i =>
            i.type === 'BANK_ACCOUNT' && i.last4 === signals.bankAccountLast4
        );
        if (inst) return formatInstrument(inst);
    }

    // 4. Fallback to first bank account (UNKNOWN)
    const fallback = instruments.find(i => i.type === 'BANK_ACCOUNT');
    return fallback ? formatInstrument(fallback) : null;
}

function formatInstrument(inst) {
    const kindMap = {
        'CREDIT_CARD': { kind: 'CREDIT_CARD', refModel: 'CreditCard' },
        'BANK_ACCOUNT': { kind: 'BANK_ACCOUNT', refModel: 'BankAccount' }
    };

    const mapping = kindMap[inst.type] || kindMap['BANK_ACCOUNT'];
    return {
        kind: mapping.kind,
        refModel: mapping.refModel,
        instrumentId: inst._id,
        billingCycleDay: inst.billingCycleDay ?? null
    };
}

function isValidCycle(cycle) {
    return /^(0[1-9]|1[0-2])-\d{4}$/.test(cycle);
}

function formatCycle(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${year}`;
}

function computeCycle(date, resolvedInstrument) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return null;
    }

    if (resolvedInstrument?.kind === 'CREDIT_CARD') {
        const billingCycleDay = Number(resolvedInstrument.billingCycleDay);

        if (Number.isInteger(billingCycleDay) && billingCycleDay >= 1 && billingCycleDay <= 31) {
            const cycleDate = new Date(date);

            if (date.getDate() >= billingCycleDay) {
                cycleDate.setMonth(cycleDate.getMonth() + 1);
            }

            return formatCycle(cycleDate);
        }
    }

    return formatCycle(date);
}

/**
 * Derives paymentMode from AI signals and resolved instrument.
 */
function derivePaymentMode(aiData, resolvedInstrument) {
    const signals = aiData.LLMMeta?.instrumentSignals || {};

    // If AI explicitly returned a paymentMode, validate and use it
    if (aiData.paymentMode) {
        const valid = ['UPI', 'CARD_PAYMENT', 'ATM_WITHDRAWAL', 'NET_BANKING', 'ONLINE_TRANSACTION'];
        const legacyMap = { CREDIT_CARD: 'CARD_PAYMENT', DEBIT_CARD: 'CARD_PAYMENT' };
        const upper = aiData.paymentMode.toUpperCase();
        if (valid.includes(upper)) {
            return upper;
        }
        if (legacyMap[upper]) {
            return legacyMap[upper];
        }
        console.warn(`[postProcessor] Unknown paymentMode from LLM: "${aiData.paymentMode}" — setting to null`);
        return null;
    }

    // Derive from instrument and signals
    if (resolvedInstrument?.kind === 'CREDIT_CARD') return 'CARD_PAYMENT';
    if (signals.upiId) return 'UPI';
    if (signals.cardLast4 && resolvedInstrument?.kind === 'BANK_ACCOUNT') return 'CARD_PAYMENT';

    // Default for bank account transactions
    return 'NET_BANKING';
}



/**
 * Validates core requirements. Throws if critical fields are missing.
 */
function validateCore(transaction) {
    const errors = [];

    if (!transaction.date) errors.push('Missing or invalid date');
    if (transaction.amount <= 0) errors.push('Amount must be greater than 0');
    if (!['DEBIT', 'CREDIT'].includes(transaction.type)) errors.push('Invalid transaction type');
    if (!transaction.merchantRaw) errors.push('Missing merchantRaw');
    if (!transaction.merchantNormalized) errors.push('Missing merchantNormalized');
    if (!transaction.paymentSource) errors.push('Missing or unresolvable paymentSource');
    if (!transaction.paymentMode) errors.push('Missing paymentMode');
    if (!transaction.cycle) errors.push('Missing cycle');
    if (transaction.cycle && !isValidCycle(transaction.cycle)) errors.push('Invalid cycle format');

    // Critical failures throw
    if (!transaction.date || transaction.amount <= 0 || !transaction.type || !transaction.cycle || !isValidCycle(transaction.cycle)) {
        throw new Error(`Critical validation failed: ${errors.join(', ')}`);
    }

    return errors;
}

/**
 * Main processor function.
 */
async function processAITransaction({
    aiData,
    userId,
    messageId,
    threadId,
    referenceData
}) {
    const transaction = normalizeCore(aiData, userId, messageId, threadId);

    transaction.category = resolveCategory(aiData.categoryId, referenceData);
    transaction.subCategory = resolveSubCategory(aiData.subCategoryId, transaction.category, referenceData);
    transaction.paymentSource = resolvePaymentSource(aiData, referenceData);
    transaction.paymentMode = derivePaymentMode(aiData, transaction.paymentSource);
    transaction.cycle = computeCycle(transaction.date, transaction.paymentSource);

    // Map cardType from LLMMeta.instrumentSignals
    const rawCardType = aiData.LLMMeta?.instrumentSignals?.cardType ?? null;
    const validCardTypes = ['CREDIT', 'DEBIT'];
    if (rawCardType !== null && !validCardTypes.includes(rawCardType)) {
        console.warn(`[postProcessor] Invalid cardType from LLM: "${rawCardType}" — setting to null`);
    }
    if (transaction.LLMMeta && transaction.LLMMeta.instrumentSignals !== undefined) {
        transaction.LLMMeta.instrumentSignals.cardType = validCardTypes.includes(rawCardType) ? rawCardType : null;
    } else if (transaction.LLMMeta) {
        transaction.LLMMeta.instrumentSignals = {
            ...(aiData.LLMMeta?.instrumentSignals || {}),
            cardType: validCardTypes.includes(rawCardType) ? rawCardType : null
        };
    }

    // Normalize categorySubCategorySignals.isGuessed
    const rawCatSignals = aiData.LLMMeta?.categorySubCategorySignals;
    const isGuessed = typeof rawCatSignals?.isGuessed === 'boolean' ? rawCatSignals.isGuessed : false;
    if (transaction.LLMMeta) {
        transaction.LLMMeta.categorySubCategorySignals = {
            isGuessed,
            categoryId: rawCatSignals?.categoryId ?? null,
            subCategoryId: rawCatSignals?.subCategoryId ?? null
        };
    }

    validateCore(transaction);

    return transaction;
}

module.exports = {
    processAITransaction
};
