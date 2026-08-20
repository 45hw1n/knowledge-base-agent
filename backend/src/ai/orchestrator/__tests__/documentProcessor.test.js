jest.mock('../../../services/gmailService', () => ({ fetchAttachment: jest.fn() }));
jest.mock('../../../documentParsing/client', () => ({ parse: jest.fn() }));
jest.mock('../structuredExtraction', () => ({ runStructuredExtraction: jest.fn() }));

const gmailService = require('../../../services/gmailService');
const documentParserClient = require('../../../documentParsing/client');
const { runStructuredExtraction } = require('../structuredExtraction');
const { runDocumentProcessor, mergeAcrossAttachments } = require('../documentProcessor');

function emailDoc(attachments) {
  return { accountUserId: 'user-1', messageId: 'msg-1', attachments };
}

describe('documentProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runDocumentProcessor', () => {
    it('returns null (not an error) when the email has no attachments', async () => {
      const result = await runDocumentProcessor({ emailDoc: emailDoc([]), type: 'INVOICE' });
      expect(result).toBeNull();
      expect(gmailService.fetchAttachment).not.toHaveBeenCalled();
    });

    it('fetches, parses, and extracts from a single attachment', async () => {
      gmailService.fetchAttachment.mockResolvedValue(Buffer.from('pdf-bytes'));
      documentParserClient.parse.mockResolvedValue({ text: 'Invoice total $500' });
      runStructuredExtraction.mockResolvedValue({ data: { amount: { value: 500 } }, error: null });

      const result = await runDocumentProcessor({
        emailDoc: emailDoc([{ attachmentId: 'a1', filename: 'invoice.pdf', mimeType: 'application/pdf' }]),
        type: 'INVOICE',
      });

      expect(gmailService.fetchAttachment).toHaveBeenCalledWith('user-1', 'msg-1', 'a1');
      expect(runStructuredExtraction).toHaveBeenCalledWith('Invoice total $500', 'INVOICE');
      expect(result).toEqual({ amount: { value: 500 } });
    });

    it('skips an attachment whose OCR produced no text, without calling structured extraction', async () => {
      gmailService.fetchAttachment.mockResolvedValue(Buffer.from(''));
      documentParserClient.parse.mockResolvedValue({ text: '' });

      const result = await runDocumentProcessor({
        emailDoc: emailDoc([{ attachmentId: 'a1', filename: 'blank.pdf', mimeType: 'application/pdf' }]),
        type: 'INVOICE',
      });

      expect(runStructuredExtraction).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('continues processing remaining attachments when one fails to fetch/parse', async () => {
      gmailService.fetchAttachment
        .mockRejectedValueOnce(new Error('Gmail API error'))
        .mockResolvedValueOnce(Buffer.from('pdf-bytes'));
      documentParserClient.parse.mockResolvedValue({ text: 'Invoice total $500' });
      runStructuredExtraction.mockResolvedValue({ data: { amount: { value: 500 } }, error: null });

      const result = await runDocumentProcessor({
        emailDoc: emailDoc([
          { attachmentId: 'a1', filename: 'broken.pdf', mimeType: 'application/pdf' },
          { attachmentId: 'a2', filename: 'invoice.pdf', mimeType: 'application/pdf' },
        ]),
        type: 'INVOICE',
      });

      expect(result).toEqual({ amount: { value: 500 } });
    });

    it('skips an attachment whose structured extraction returned an error', async () => {
      gmailService.fetchAttachment.mockResolvedValue(Buffer.from('pdf-bytes'));
      documentParserClient.parse.mockResolvedValue({ text: 'garbled ocr text' });
      runStructuredExtraction.mockResolvedValue({ data: null, error: 'Failed to parse AI response as JSON' });

      const result = await runDocumentProcessor({
        emailDoc: emailDoc([{ attachmentId: 'a1', filename: 'invoice.pdf', mimeType: 'application/pdf' }]),
        type: 'INVOICE',
      });

      expect(result).toBeNull();
    });
  });

  describe('mergeAcrossAttachments', () => {
    it('returns null for an empty result set', () => {
      expect(mergeAcrossAttachments([])).toBeNull();
    });

    it('returns the single result unchanged when there is only one', () => {
      const single = { amount: { value: 500 } };
      expect(mergeAcrossAttachments([single])).toBe(single);
    });

    it('merges non-conflicting fields across attachments', () => {
      const merged = mergeAcrossAttachments([
        { amount: { value: 500, currency: 'USD' }, dueDate: null },
        { amount: null, dueDate: '2026-01-01' },
      ]);
      expect(merged).toEqual({ amount: { value: 500, currency: 'USD' }, dueDate: '2026-01-01' });
    });

    it('resolves a conflicting field via first-non-null-wins and logs a warning', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const merged = mergeAcrossAttachments([
        { amount: { value: 500, currency: 'USD' } },
        { amount: { value: 999, currency: 'USD' } },
      ]);

      expect(merged.amount).toEqual({ value: 500, currency: 'USD' });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Conflicting "amount"'),
        expect.anything()
      );

      warnSpy.mockRestore();
    });
  });
});
