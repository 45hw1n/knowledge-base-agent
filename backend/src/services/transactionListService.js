const { createListService } = require('../listing/core');
const { transactionsListConfig } = require('../listing/configs/transactions.listConfig');
const { buildInstrumentMap } = require('../utils/paymentSource.utils');
const { normalizeAttachment } = require('../utils/attachmentMapper.utils');

const transactionsListService = createListService(transactionsListConfig);

function normalizeCategory(cat) {
    if (!cat || typeof cat !== 'object') return null;
    return { id: cat.id ?? null, value: cat.value ?? null, label: cat.label ?? null };
}

function normalizeTransaction(doc, instrumentMap = new Map()) {
    if (!doc) return doc;
    const ps = doc.paymentSource;
    const instrumentId = ps?.instrumentId?.toString() ?? null;
    const instrument = instrumentId ? (instrumentMap.get(instrumentId) ?? null) : null;

    return {
        id: doc._id.toString(),
        displayId: doc.displayId,
        amount: doc.amount,
        currency: doc.currency ?? 'INR',
        type: doc.type,
        date: doc.date?.toISOString?.() ?? null,
        name: doc.name,
        merchant: doc.merchantNormalized ?? '',
        notes: doc.notes ?? null,
        category: normalizeCategory(doc.category),
        subCategory: normalizeCategory(doc.subCategory),
        paymentMode: doc.paymentMode,
        paymentSource: ps
            ? {
                  kind: ps.kind,
                  instrumentId,
                  displayName: instrument?.displayName ?? null,
                  last4: instrument?.last4 ?? null,
                  bank: instrument?.bank ?? null
              }
            : null,
        source: doc.source ?? null,
        cycle: doc.cycle ?? null,
        isCreditCardRepayment: doc.isCreditCardRepayment ?? false,
        isPrivate: doc.isPrivate ?? false,
        isEmiInstallment: doc.isEmiInstallment ?? false,
        approvalActor: doc.approvalActor ?? null,
        sheetSyncStatus: doc.sheetSyncStatus ?? null,
        attachments: (doc.attachments ?? []).map(normalizeAttachment),
        createdAt: doc.createdAt?.toISOString?.() ?? '',
        updatedAt: doc.updatedAt?.toISOString?.() ?? null
    };
}

function shapeTransactionsListInfo(listInfo) {
    return {
        page: listInfo.page,
        pageSize: listInfo.pageSize,
        sort: (listInfo.sort || []).map((e) => ({ attribute: e.attribute, order: e.order })),
        conditions: listInfo.conditions ?? null
    };
}

async function listTransactions(input, runtimeContext) {
    const listPayload = input?.listInfo ?? {};
    const raw = await transactionsListService.list(listPayload, runtimeContext);
    const instrumentMap = await buildInstrumentMap(raw.data);
    return {
        data: raw.data.map((doc) => normalizeTransaction(doc, instrumentMap)),
        listInfo: shapeTransactionsListInfo(raw.listInfo),
        pagination: raw.pagination,
        meta: raw.meta
    };
}

module.exports = { listTransactions, normalizeTransaction };
