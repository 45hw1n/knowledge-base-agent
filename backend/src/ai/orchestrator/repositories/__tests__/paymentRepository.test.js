jest.mock('../../../../models/Payment', () => {
  const mockCtor = jest.fn();
  mockCtor.findOne = jest.fn();
  mockCtor.find = jest.fn();
  mockCtor.create = jest.fn();
  mockCtor.updateOne = jest.fn().mockResolvedValue({});
  mockCtor.validateExtractedPayment = jest.fn();
  return mockCtor;
});
jest.mock('../../../../models/Invoice', () => {
  const mockCtor = jest.fn();
  mockCtor.find = jest.fn();
  mockCtor.updateOne = jest.fn().mockResolvedValue({});
  mockCtor.determineInvoiceStatus = jest.fn();
  return mockCtor;
});
jest.mock('../../../../services/paymentReconciliationService', () => ({
  findMatchingInvoice: jest.fn(),
  determineLinkMethod: jest.fn(),
}));
jest.mock('../../../../services/sourceUrlService', () => ({ buildSourceUrl: jest.fn() }));
jest.mock('../entityRepository', () => ({ createEntityForTypedChild: jest.fn() }));

const mongoose = require('mongoose');
const Payment = require('../../../../models/Payment');
const Invoice = require('../../../../models/Invoice');
const { findMatchingInvoice, determineLinkMethod } = require('../../../../services/paymentReconciliationService');
const { buildSourceUrl } = require('../../../../services/sourceUrlService');
const { createEntityForTypedChild } = require('../entityRepository');
const { persistPayment, buildPaymentTitle } = require('../paymentRepository');

describe('paymentRepository', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const emailDoc = {
    _id: new mongoose.Types.ObjectId(),
    messageId: 'msg-1',
    threadId: 'thread-1',
    date: 'Mon, 01 Jan 2024 00:00:00 GMT',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    buildSourceUrl.mockReturnValue('https://mail.google.com/mail/u/0/#all/msg-1');
    createEntityForTypedChild.mockResolvedValue({ _id: 'entity-1' });
    Invoice.find.mockResolvedValue([]);
    Payment.find.mockReturnValue({ lean: () => Promise.resolve([]) });
  });

  describe('buildPaymentTitle', () => {
    it('formats amount + currency', () => {
      expect(buildPaymentTitle({ amount: { value: 500, currency: 'USD' } })).toBe('Payment of 500 USD');
    });
  });

  describe('paidAt fallback', () => {
    it('falls back to the email\'s Date header when the AI found no paidAt', async () => {
      Payment.findOne.mockResolvedValue(null);
      Payment.validateExtractedPayment.mockImplementation((raw) => ({ payment: raw, error: null }));
      Payment.create.mockResolvedValue({ userId, amount: { value: 500 }, paidAt: new Date(emailDoc.date), invoiceId: null, threadId: 'thread-1' });

      await persistPayment({ userId, emailDoc, extracted: { amount: { value: 500 }, paidAt: null } });

      const [rawPassed] = Payment.validateExtractedPayment.mock.calls[0];
      expect(rawPassed.paidAt).toEqual(new Date(emailDoc.date));
    });

    it('uses the AI-extracted paidAt when present, not the email date', async () => {
      Payment.findOne.mockResolvedValue(null);
      Payment.validateExtractedPayment.mockImplementation((raw) => ({ payment: raw, error: null }));
      Payment.create.mockResolvedValue({ userId, amount: { value: 500 }, paidAt: new Date('2026-02-01'), invoiceId: null, threadId: 'thread-1' });

      await persistPayment({ userId, emailDoc, extracted: { amount: { value: 500 }, paidAt: '2026-02-01' } });

      const [rawPassed] = Payment.validateExtractedPayment.mock.calls[0];
      expect(rawPassed.paidAt).toBe('2026-02-01');
    });
  });

  describe('validation failure', () => {
    it('propagates the error without creating anything', async () => {
      Payment.findOne.mockResolvedValue(null);
      Payment.validateExtractedPayment.mockReturnValue({ payment: null, error: 'Extracted payment is missing a required numeric "amount.value"' });

      const result = await persistPayment({ userId, emailDoc, extracted: {} });

      expect(Payment.create).not.toHaveBeenCalled();
      expect(createEntityForTypedChild).not.toHaveBeenCalled();
      expect(result.error).toMatch(/amount.value/);
    });
  });

  describe('idempotency', () => {
    it('returns the existing Payment + ensures its Entity row exists, without re-creating', async () => {
      const existing = { _id: 'payment-1', amount: { value: 500 }, invoiceId: null };
      Payment.findOne.mockResolvedValue(existing);

      const result = await persistPayment({ userId, emailDoc, extracted: { amount: { value: 999 } } });

      expect(Payment.create).not.toHaveBeenCalled();
      expect(findMatchingInvoice).not.toHaveBeenCalled();
      expect(result).toEqual({ payment: existing, entity: { _id: 'entity-1' }, error: null });
    });

    it('fetches the existing Payment on a duplicate-key race instead of erroring', async () => {
      Payment.findOne.mockResolvedValueOnce(null);
      Payment.validateExtractedPayment.mockReturnValue({ payment: { amount: { value: 500 } }, error: null });

      const dupError = new Error('duplicate key');
      dupError.code = 11000;
      Payment.create.mockRejectedValue(dupError);

      const winner = { _id: 'payment-winner', amount: { value: 500 }, invoiceId: 'inv-1', threadId: null };
      Payment.findOne.mockResolvedValueOnce(winner);

      const result = await persistPayment({ userId, emailDoc, extracted: { amount: { value: 500 } } });

      expect(result.payment).toBe(winner);
    });
  });

  describe('same-thread auto-link', () => {
    it('does not query Invoice candidates when the payment has no threadId', async () => {
      Payment.findOne.mockResolvedValue(null);
      Payment.validateExtractedPayment.mockImplementation((raw) => ({ payment: raw, error: null }));
      Payment.create.mockResolvedValue({ userId, amount: { value: 500 }, paidAt: new Date(), invoiceId: null, threadId: null });

      await persistPayment({ userId, emailDoc: { ...emailDoc, threadId: null }, extracted: { amount: { value: 500 } } });

      expect(Invoice.find).not.toHaveBeenCalled();
    });

    it('leaves the Payment unlinked when no same-thread Invoice clears the match threshold', async () => {
      Payment.findOne.mockResolvedValue(null);
      Payment.validateExtractedPayment.mockImplementation((raw) => ({ payment: raw, error: null }));
      const created = { userId, amount: { value: 500 }, paidAt: new Date(), invoiceId: null, threadId: 'thread-1' };
      Payment.create.mockResolvedValue(created);
      Invoice.find.mockResolvedValue([{ _id: 'inv-1', threadId: 'thread-1', amount: { value: 999 } }]);
      findMatchingInvoice.mockReturnValue(null);

      await persistPayment({ userId, emailDoc, extracted: { amount: { value: 500 } } });

      expect(Invoice.find).toHaveBeenCalledWith({ userId, threadId: 'thread-1' });
      expect(Payment.updateOne).not.toHaveBeenCalled();
      expect(Invoice.updateOne).not.toHaveBeenCalled();
    });

    it('auto-links and re-derives Invoice.status when a same-thread match clears the threshold', async () => {
      Payment.findOne.mockResolvedValue(null);
      Payment.validateExtractedPayment.mockImplementation((raw) => ({ payment: raw, error: null }));
      const created = { userId, _id: 'payment-1', amount: { value: 500 }, paidAt: new Date(), invoiceId: null, threadId: 'thread-1' };
      Payment.create.mockResolvedValue(created);

      const matchedInvoice = { _id: 'inv-1', threadId: 'thread-1', amount: { value: 500 }, dueDate: null };
      Invoice.find.mockResolvedValue([matchedInvoice]);
      findMatchingInvoice.mockReturnValue({ invoice: matchedInvoice, score: 0.65, matchedSignals: ['same_thread', 'exact_amount'] });
      determineLinkMethod.mockReturnValue('THREAD_CONTEXT');
      Payment.find.mockReturnValue({ lean: () => Promise.resolve([{ amount: { value: 500 } }]) }); // linked payments for status re-derivation
      Invoice.determineInvoiceStatus.mockReturnValue('PAID');

      const result = await persistPayment({ userId, emailDoc, extracted: { amount: { value: 500 } } });

      expect(findMatchingInvoice).toHaveBeenCalledWith(
        { amount: { value: 500 }, payer: undefined, payee: undefined, threadId: 'thread-1' },
        [matchedInvoice]
      );
      expect(Payment.updateOne).toHaveBeenCalledWith(
        { _id: 'payment-1' },
        { $set: { invoiceId: 'inv-1', linkMethod: 'THREAD_CONTEXT' } }
      );
      expect(Invoice.updateOne).toHaveBeenCalledWith({ _id: 'inv-1' }, { $set: { status: 'PAID' } });
      expect(result.payment.invoiceId).toBe('inv-1');
      expect(result.payment.linkMethod).toBe('THREAD_CONTEXT');
    });
  });
});
