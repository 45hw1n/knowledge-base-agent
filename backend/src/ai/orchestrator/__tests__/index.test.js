jest.mock('../../../utils/emailEncryption', () => ({ decryptClearText: jest.fn() }));
jest.mock('../documentProcessor', () => ({ runDocumentProcessor: jest.fn() }));
jest.mock('../structuredExtraction', () => ({ runStructuredExtraction: jest.fn() }));
jest.mock('../textSummaryProcessor', () => ({ summarizeBody: jest.fn() }));
jest.mock('../repositories/invoiceRepository', () => ({ persistInvoice: jest.fn() }));
jest.mock('../repositories/paymentRepository', () => ({ persistPayment: jest.fn() }));

const { decryptClearText } = require('../../../utils/emailEncryption');
const { runDocumentProcessor } = require('../documentProcessor');
const { runStructuredExtraction } = require('../structuredExtraction');
const { summarizeBody } = require('../textSummaryProcessor');
const { persistInvoice } = require('../repositories/invoiceRepository');
const { persistPayment } = require('../repositories/paymentRepository');
const { extractAndPersistEntity } = require('../index');

function emailDoc({ type, attachments = [] } = {}) {
  return {
    accountUserId: 'user-1',
    messageId: 'msg-1',
    threadId: 'thread-1',
    encryptedCleanText: { encrypted: true },
    attachments,
    classification: { candidates: type ? [{ type, score: 0.9 }] : [] },
  };
}

describe('ai/orchestrator/index — extractAndPersistEntity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    decryptClearText.mockReturnValue('decrypted body text');
    summarizeBody.mockResolvedValue('a summary');
  });

  it('errors immediately when the email has no classifier candidates', async () => {
    const result = await extractAndPersistEntity(emailDoc({ type: null }));

    expect(result).toEqual({ entityCreated: false, entityId: null, type: null, error: 'No classifier candidates on this email' });
    expect(runDocumentProcessor).not.toHaveBeenCalled();
    expect(runStructuredExtraction).not.toHaveBeenCalled();
  });

  it('uses the top classifier candidate, skipping any others', async () => {
    const doc = {
      ...emailDoc({ type: 'INVOICE' }),
      classification: { candidates: [{ type: 'INVOICE', score: 0.9 }, { type: 'PAYMENT', score: 0.4 }] },
    };
    runStructuredExtraction.mockResolvedValue({ data: { amount: { value: 500 } }, error: null });
    persistInvoice.mockResolvedValue({ invoice: {}, entity: { _id: 'entity-1' }, error: null });

    const result = await extractAndPersistEntity(doc);

    expect(result.type).toBe('INVOICE');
    expect(persistPayment).not.toHaveBeenCalled();
  });

  it('when attachments exist, uses the Document Processor result and never falls back to body extraction', async () => {
    runDocumentProcessor.mockResolvedValue({ amount: { value: 500 } });
    persistInvoice.mockResolvedValue({ invoice: {}, entity: { _id: 'entity-1' }, error: null });

    const result = await extractAndPersistEntity(emailDoc({ type: 'INVOICE', attachments: [{ attachmentId: 'a1' }] }));

    expect(runDocumentProcessor).toHaveBeenCalledWith({ emailDoc: expect.anything(), type: 'INVOICE' });
    expect(runStructuredExtraction).not.toHaveBeenCalled();
    expect(result.entityCreated).toBe(true);
  });

  it('falls back to body extraction when the Document Processor found nothing', async () => {
    runDocumentProcessor.mockResolvedValue(null);
    runStructuredExtraction.mockResolvedValue({ data: { amount: { value: 500 } }, error: null });
    persistInvoice.mockResolvedValue({ invoice: {}, entity: { _id: 'entity-1' }, error: null });

    await extractAndPersistEntity(emailDoc({ type: 'INVOICE', attachments: [{ attachmentId: 'a1' }] }));

    expect(runStructuredExtraction).toHaveBeenCalledWith('decrypted body text', 'INVOICE');
  });

  it('skips the Document Processor entirely when there are no attachments', async () => {
    runStructuredExtraction.mockResolvedValue({ data: { amount: { value: 500 } }, error: null });
    persistInvoice.mockResolvedValue({ invoice: {}, entity: { _id: 'entity-1' }, error: null });

    await extractAndPersistEntity(emailDoc({ type: 'INVOICE' }));

    expect(runDocumentProcessor).not.toHaveBeenCalled();
  });

  it('always runs the Text/Summary Processor, even when structured extraction found nothing useful yet', async () => {
    runStructuredExtraction.mockResolvedValue({ data: { amount: { value: 500 } }, error: null });
    persistInvoice.mockResolvedValue({ invoice: {}, entity: { _id: 'entity-1' }, error: null });

    await extractAndPersistEntity(emailDoc({ type: 'INVOICE' }));

    expect(summarizeBody).toHaveBeenCalledWith('decrypted body text');
    const [persistArgs] = persistInvoice.mock.calls[0];
    expect(persistArgs.summary).toBe('a summary');
  });

  it('propagates a structured-extraction error without calling the repository', async () => {
    runStructuredExtraction.mockResolvedValue({ data: null, error: 'Failed to parse AI response as JSON' });

    const result = await extractAndPersistEntity(emailDoc({ type: 'INVOICE' }));

    expect(persistInvoice).not.toHaveBeenCalled();
    expect(result).toEqual({ entityCreated: false, entityId: null, type: 'INVOICE', error: 'Failed to parse AI response as JSON' });
  });

  it('errors when nothing was extracted from either attachments or the body', async () => {
    runStructuredExtraction.mockResolvedValue({ data: null, error: null });

    const result = await extractAndPersistEntity(emailDoc({ type: 'INVOICE' }));

    expect(persistInvoice).not.toHaveBeenCalled();
    expect(result.error).toMatch(/No INVOICE data could be extracted/);
  });

  it('errors for a classified type with no repository configured yet', async () => {
    // All 5 real Entity types now have a configured repository — use a
    // nonexistent type to exercise this fallback path.
    runStructuredExtraction.mockResolvedValue({ data: { title: 'Login broken' }, error: null });

    const result = await extractAndPersistEntity(emailDoc({ type: 'UNKNOWN_TYPE' }));

    expect(result.error).toMatch(/No repository configured for type "UNKNOWN_TYPE"/);
  });

  it('propagates a repository-level error (e.g. validation failure)', async () => {
    runStructuredExtraction.mockResolvedValue({ data: { amount: { value: 500 } }, error: null });
    persistInvoice.mockResolvedValue({ invoice: null, entity: null, error: 'Extracted invoice is missing a required numeric "amount.value"' });

    const result = await extractAndPersistEntity(emailDoc({ type: 'INVOICE' }));

    expect(result).toEqual({ entityCreated: false, entityId: null, type: 'INVOICE', error: 'Extracted invoice is missing a required numeric "amount.value"' });
  });

  it('returns entityCreated:true with the entityId on success', async () => {
    runStructuredExtraction.mockResolvedValue({ data: { amount: { value: 500 } }, error: null });
    persistInvoice.mockResolvedValue({ invoice: {}, entity: { _id: { toString: () => 'entity-123' } }, error: null });

    const result = await extractAndPersistEntity(emailDoc({ type: 'INVOICE' }));

    expect(result).toEqual({ entityCreated: true, entityId: 'entity-123', type: 'INVOICE', error: null });
  });
});
