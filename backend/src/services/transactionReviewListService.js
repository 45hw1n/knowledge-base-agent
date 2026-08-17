const { createListService } = require('../listing/core');
const { transactionsToReviewListConfig } = require('../listing/configs/transactionsToReview.listConfig');
const { buildInstrumentMap } = require('../utils/paymentSource.utils');
const { normalizeAttachment } = require('../utils/attachmentMapper.utils');

const transactionsToReviewListService = createListService(transactionsToReviewListConfig);

function normalizeCategory(cat) {
    if (!cat || typeof cat !== 'object') return null;
    return {
        id: cat.id ?? null,
        value: cat.value ?? null,
        label: cat.label ?? null
    };
}

function normalizeTransactionToReview(doc, instrumentMap = new Map()) {
    const ps = doc.paymentSource;
    const instrumentId = ps?.instrumentId?.toString() ?? null;
    const instrument = instrumentId ? (instrumentMap.get(instrumentId) ?? null) : null;

    return {
        id: doc._id.toString(),
        amount: doc.amount,
        currency: doc.currency ?? 'INR',
        merchant: doc.merchantNormalized ?? '',
        merchantRaw: doc.merchantRaw ?? null,
        name: doc.name ?? null,
        status: doc.status,
        category: normalizeCategory(doc.category),
        subCategory: normalizeCategory(doc.subCategory),
        paymentMode: doc.paymentMode ?? null,
        isCreditCardRepayment: doc.isCreditCardRepayment ?? false,
        isPrivate: doc.userApprovedData?.isPrivate ?? false,
        paymentSource: ps
            ? {
                  kind: ps.kind,
                  instrumentId,
                  displayName: instrument?.displayName ?? null,
                  last4: instrument?.last4 ?? null,
                  bank: instrument?.bank ?? null
              }
            : null,
        type: doc.type ?? null,
        date: doc.date?.toISOString?.() ?? null,
        cycle: doc.cycle ?? null,
        notes: doc.notes ?? null,
        referenceId: doc.referenceId ?? null,
        aiConfidence: doc.LLMMeta?.confidence?.overall ?? null,
        approvedAt: doc.approvedAt?.toISOString?.() ?? null,
        transactionId: doc.transactionId?.toString() ?? null,
        rejectedAt: doc.rejectedAt?.toISOString?.() ?? null,
        rejectionNote: doc.userRejectedData?.note ?? null,
        attachments: (doc.attachments ?? []).map(normalizeAttachment),
        createdAt: doc.createdAt?.toISOString?.() ?? '',
        updatedAt: doc.updatedAt?.toISOString?.() ?? null
    };
}

function shapeTransactionsToReviewListInfo(listInfo) {
    return {
        page: listInfo.page,
        pageSize: listInfo.pageSize,
        sort: (listInfo.sort || []).map((entry) => ({
            attribute: entry.attribute,
            order: entry.order
        })),
        conditions: listInfo.conditions ?? null
    };
}

/** @param {{ listInfo?: Object }} input */
async function listTransactionsToReview(input, runtimeContext) {
    const listPayload = input?.listInfo ?? {};
    const raw = await transactionsToReviewListService.list(listPayload, runtimeContext);

    const instrumentMap = await buildInstrumentMap(raw.data);

    return {
        data: raw.data.map((doc) => normalizeTransactionToReview(doc, instrumentMap)),
        listInfo: shapeTransactionsToReviewListInfo(raw.listInfo),
        pagination: raw.pagination,
        meta: raw.meta
    };
}

module.exports = {
    listTransactionsToReview,
    normalizeTransactionToReview,
    buildInstrumentMap
};
