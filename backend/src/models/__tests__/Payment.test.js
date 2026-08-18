const mongoose = require('mongoose');
const Payment = require('../Payment');
const { validateExtractedPayment, requiresUnlinkConfirmation } = require('../Payment');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function validPayment(overrides = {}) {
  return new Payment({
    userId: objectId(),
    amount: { value: 5000, currency: 'INR' },
    paidAt: new Date('2026-08-25T10:00:00Z'),
    payer: { name: 'John Doe', email: 'john@example.com' },
    payee: { name: 'Acme Corp', email: 'billing@acme.com' },
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/msg002',
    sourceType: 'EMAIL',
    threadId: 'thread_100',
    messageId: 'msg_002',
    ...overrides,
  });
}

describe('Payment — valid creation', () => {
  it('validates a fully-populated Payment with no errors', () => {
    expect(validPayment().validateSync()).toBeUndefined();
  });

  it('has no status field — Payment either exists or does not', () => {
    expect(Payment.schema.path('status')).toBeUndefined();
  });

  it('has no entityType/entityId back-references', () => {
    expect(Payment.schema.path('entityType')).toBeUndefined();
    expect(Payment.schema.path('entityId')).toBeUndefined();
  });
});

describe('Payment — required fields', () => {
  it('requires amount', () => {
    const error = validPayment({ amount: undefined }).validateSync();
    expect(error?.errors?.amount).toBeDefined();
  });

  it('requires amount.value', () => {
    const error = validPayment({ amount: { currency: 'INR' } }).validateSync();
    expect(error?.errors?.['amount.value']).toBeDefined();
  });

  it('requires paidAt', () => {
    const error = validPayment({ paidAt: undefined }).validateSync();
    expect(error?.errors?.paidAt).toBeDefined();
  });

  it('requires sourceUrl', () => {
    const error = validPayment({ sourceUrl: undefined }).validateSync();
    expect(error?.errors?.sourceUrl).toBeDefined();
  });

  it('requires messageId when sourceType is EMAIL', () => {
    const error = validPayment({ messageId: undefined }).validateSync();
    expect(error?.errors?.messageId).toBeDefined();
  });
});

describe('Payment — invoiceId is optional', () => {
  it('validates without an invoiceId', () => {
    const payment = validPayment({ invoiceId: undefined });
    expect(payment.validateSync()).toBeUndefined();
    expect(payment.invoiceId).toBeNull();
  });

  it('accepts an invoiceId reference when provided (with its required linkMethod)', () => {
    const invoiceId = objectId();
    const payment = validPayment({ invoiceId, linkMethod: 'MANUAL' });
    expect(payment.validateSync()).toBeUndefined();
    expect(payment.invoiceId.toString()).toBe(invoiceId.toString());
  });
});

describe('Payment — payer/payee are optional and independent', () => {
  it('validates with neither payer nor payee identified', () => {
    const payment = validPayment({ payer: undefined, payee: undefined });
    expect(payment.validateSync()).toBeUndefined();
    expect(payment.payer).toBeNull();
    expect(payment.payee).toBeNull();
  });
});

describe('validateExtractedPayment — LLM structured-output validation', () => {
  it('normalizes a well-formed extracted payment without ever setting invoiceId', () => {
    const { payment, error } = validateExtractedPayment({
      amount: { value: 5000, currency: 'INR' },
      paidAt: '2026-08-25T10:00:00Z',
      payer: { name: 'John Doe', email: 'john@example.com' },
      payee: { name: 'Acme Corp', email: 'billing@acme.com' },
      invoiceId: 'inv_should_be_ignored',
      sourceUrl: 'https://mail.google.com/mail/u/0/#all/msg002',
      sourceType: 'EMAIL',
      threadId: 'thread_100',
      messageId: 'msg_002',
    });

    expect(error).toBeNull();
    expect(payment.amount).toEqual({ value: 5000, currency: 'INR' });
    expect(payment.payer.email).toBe('john@example.com');
    // Linking is exclusively the reconciliation service's job.
    expect(payment.invoiceId).toBeNull();
  });

  it('rejects missing amount.value', () => {
    const { payment, error } = validateExtractedPayment({
      paidAt: '2026-08-25T10:00:00Z',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(payment).toBeNull();
    expect(error).toMatch(/amount/);
  });

  it('rejects missing/invalid paidAt', () => {
    const { payment, error } = validateExtractedPayment({
      amount: { value: 5000 },
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(payment).toBeNull();
    expect(error).toMatch(/paidAt/);
  });

  it('rejects missing sourceUrl', () => {
    const { payment, error } = validateExtractedPayment({
      amount: { value: 5000 },
      paidAt: '2026-08-25T10:00:00Z',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(payment).toBeNull();
    expect(error).toMatch(/sourceUrl/);
  });

  it('rejects missing messageId when sourceType is EMAIL', () => {
    const { payment, error } = validateExtractedPayment({
      amount: { value: 5000 },
      paidAt: '2026-08-25T10:00:00Z',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
    });
    expect(payment).toBeNull();
    expect(error).toMatch(/messageId/);
  });

  it('never throws on malformed input', () => {
    expect(() => validateExtractedPayment(null)).not.toThrow();
    expect(() => validateExtractedPayment(undefined)).not.toThrow();
    expect(() => validateExtractedPayment({ amount: 'not an object' })).not.toThrow();
  });
});

describe('Payment — linkMethod', () => {
  function objectId() {
    return new mongoose.Types.ObjectId();
  }

  it.each(['THREAD_CONTEXT', 'RECONCILED', 'MANUAL'])('accepts %s when invoiceId is set', (linkMethod) => {
    const payment = validPayment({ invoiceId: objectId(), linkMethod });
    expect(payment.validateSync()).toBeUndefined();
  });

  it('rejects an invalid linkMethod', () => {
    const error = validPayment({ invoiceId: objectId(), linkMethod: 'GUESSED' }).validateSync();
    expect(error?.errors?.linkMethod).toBeDefined();
  });

  it('requires linkMethod when invoiceId is set', () => {
    const error = validPayment({ invoiceId: objectId(), linkMethod: undefined }).validateSync();
    expect(error?.errors?.linkMethod).toBeDefined();
  });

  it('rejects linkMethod being set when invoiceId is not set', () => {
    const error = validPayment({ invoiceId: undefined, linkMethod: 'MANUAL' }).validateSync();
    expect(error?.errors?.linkMethod).toBeDefined();
  });

  it('defaults to null when unlinked', () => {
    const payment = validPayment({ invoiceId: undefined, linkMethod: undefined });
    expect(payment.validateSync()).toBeUndefined();
    expect(payment.linkMethod).toBeNull();
  });
});

describe('requiresUnlinkConfirmation', () => {
  it('requires confirmation for THREAD_CONTEXT links', () => {
    expect(requiresUnlinkConfirmation({ linkMethod: 'THREAD_CONTEXT' })).toBe(true);
  });

  it('does not require confirmation for RECONCILED or MANUAL links', () => {
    expect(requiresUnlinkConfirmation({ linkMethod: 'RECONCILED' })).toBe(false);
    expect(requiresUnlinkConfirmation({ linkMethod: 'MANUAL' })).toBe(false);
  });

  it('does not require confirmation when there is no link at all', () => {
    expect(requiresUnlinkConfirmation({ linkMethod: null })).toBe(false);
    expect(requiresUnlinkConfirmation(null)).toBe(false);
    expect(requiresUnlinkConfirmation(undefined)).toBe(false);
  });
});
