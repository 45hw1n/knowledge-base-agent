jest.mock('../../../../models/Invoice', () => {
  const mockCtor = jest.fn();
  mockCtor.findOne = jest.fn();
  mockCtor.create = jest.fn();
  mockCtor.validateExtractedInvoice = jest.fn();
  return mockCtor;
});
jest.mock('../../../../services/sourceUrlService', () => ({ buildSourceUrl: jest.fn() }));
jest.mock('../entityRepository', () => ({
  createEntityForTypedChild: jest.fn(),
  buildInitialConversationMessage: jest.fn(),
}));

const mongoose = require('mongoose');
const Invoice = require('../../../../models/Invoice');
const { buildSourceUrl } = require('../../../../services/sourceUrlService');
const { createEntityForTypedChild, buildInitialConversationMessage } = require('../entityRepository');
const { persistInvoice, buildInvoiceTitle } = require('../invoiceRepository');

describe('invoiceRepository', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const emailDoc = { _id: new mongoose.Types.ObjectId(), messageId: 'msg-1', threadId: 'thread-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    buildSourceUrl.mockReturnValue('https://mail.google.com/mail/u/0/#all/msg-1');
    createEntityForTypedChild.mockResolvedValue({ _id: 'entity-1' });
    buildInitialConversationMessage.mockResolvedValue(null);
  });

  describe('buildInvoiceTitle', () => {
    it('prefers the invoice number when present', () => {
      expect(buildInvoiceTitle({ invoiceNumber: 'INV-42', amount: { value: 100 } })).toBe('Invoice INV-42');
    });

    it('falls back to the amount when there is no invoice number', () => {
      expect(buildInvoiceTitle({ invoiceNumber: null, amount: { value: 100, currency: 'USD' } })).toBe('Invoice for 100 USD');
    });
  });

  describe('persistInvoice', () => {
    it('returns the existing Invoice + ensures its Entity row exists, without re-validating or re-creating', async () => {
      const existing = { _id: 'invoice-1', invoiceNumber: 'INV-1', amount: { value: 100 } };
      Invoice.findOne.mockResolvedValue(existing);

      const result = await persistInvoice({ userId, emailDoc, extracted: { amount: { value: 999 } } });

      expect(Invoice.create).not.toHaveBeenCalled();
      expect(Invoice.validateExtractedInvoice).not.toHaveBeenCalled();
      expect(createEntityForTypedChild).toHaveBeenCalledWith(expect.objectContaining({
        userId, type: 'INVOICE', entityId: 'invoice-1',
      }));
      expect(result).toEqual({ invoice: existing, entity: { _id: 'entity-1' }, error: null });
    });

    it('propagates a validation error without creating anything', async () => {
      Invoice.findOne.mockResolvedValue(null);
      Invoice.validateExtractedInvoice.mockReturnValue({ invoice: null, error: 'Extracted invoice is missing a required numeric "amount.value"' });

      const result = await persistInvoice({ userId, emailDoc, extracted: {} });

      expect(Invoice.create).not.toHaveBeenCalled();
      expect(createEntityForTypedChild).not.toHaveBeenCalled();
      expect(result.error).toMatch(/amount.value/);
    });

    it('injects app-controlled provenance fields before validating, and creates the Invoice + Entity on success', async () => {
      Invoice.findOne.mockResolvedValue(null);
      Invoice.validateExtractedInvoice.mockImplementation((raw) => ({ invoice: raw, error: null }));
      Invoice.create.mockResolvedValue({ _id: 'invoice-new', invoiceNumber: 'INV-9', amount: { value: 500 } });

      const result = await persistInvoice({
        userId, emailDoc, extracted: { invoiceNumber: 'INV-9', amount: { value: 500 } }, summary: 'A vendor invoice.',
      });

      const [rawPassedToValidate] = Invoice.validateExtractedInvoice.mock.calls[0];
      expect(rawPassedToValidate).toMatchObject({
        invoiceNumber: 'INV-9',
        sourceUrl: 'https://mail.google.com/mail/u/0/#all/msg-1',
        sourceType: 'EMAIL',
        threadId: 'thread-1',
        messageId: 'msg-1',
        metadata: { summary: 'A vendor invoice.' },
        conversation: [],
      });
      // Never AI-supplied — must always come from the app, never the extracted payload.
      expect(rawPassedToValidate.sourceUrl).not.toBe(undefined);

      expect(Invoice.create).toHaveBeenCalledWith(expect.objectContaining({ userId }));
    });

    it('seeds conversation[] with the triggering email when buildInitialConversationMessage finds one', async () => {
      Invoice.findOne.mockResolvedValue(null);
      Invoice.validateExtractedInvoice.mockImplementation((raw) => ({ invoice: raw, error: null }));
      Invoice.create.mockResolvedValue({ _id: 'invoice-new', amount: { value: 500 } });
      const seededMessage = {
        messageId: 'msg-1', direction: 'RECEIVED', content: 'Invoice attached.', timestamp: new Date(), attachments: [], sender: { name: 'Vendor', email: 'vendor@example.com' },
      };
      buildInitialConversationMessage.mockResolvedValue(seededMessage);

      await persistInvoice({ userId, emailDoc, extracted: { amount: { value: 500 } } });

      expect(buildInitialConversationMessage).toHaveBeenCalledWith({ userId, emailDoc });
      const [rawPassedToValidate] = Invoice.validateExtractedInvoice.mock.calls[0];
      expect(rawPassedToValidate.conversation).toEqual([seededMessage]);
    });

    it('fetches the existing Invoice on a duplicate-key race instead of erroring', async () => {
      Invoice.findOne.mockResolvedValueOnce(null); // initial idempotency check
      Invoice.validateExtractedInvoice.mockReturnValue({ invoice: { amount: { value: 500 } }, error: null });

      const dupError = new Error('duplicate key');
      dupError.code = 11000;
      Invoice.create.mockRejectedValue(dupError);

      const winner = { _id: 'invoice-winner', amount: { value: 500 } };
      Invoice.findOne.mockResolvedValueOnce(winner); // post-race fetch

      const result = await persistInvoice({ userId, emailDoc, extracted: { amount: { value: 500 } } });

      expect(result.invoice).toBe(winner);
    });
  });
});
