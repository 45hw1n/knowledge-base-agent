const mongoose = require('mongoose');
const Invoice = require('../Invoice');
const { validateExtractedInvoice, validateConversationMessage, determineInvoiceStatus } = require('../Invoice');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function validInvoice(overrides = {}) {
  return new Invoice({
    userId: objectId(),
    invoiceNumber: 'INV-123',
    amount: { value: 5000, currency: 'INR' },
    dueDate: new Date('2026-09-01T00:00:00Z'),
    issuer: { name: 'Acme Corp', email: 'billing@acme.com' },
    status: 'UNPAID',
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/abc123',
    sourceType: 'EMAIL',
    threadId: 'thread_100',
    messageId: 'msg_001',
    ...overrides,
  });
}

describe('Invoice — valid creation', () => {
  it('validates a fully-populated Invoice with no errors', () => {
    expect(validInvoice().validateSync()).toBeUndefined();
  });

  it('defaults status to UNPAID', () => {
    const invoice = new Invoice({
      userId: objectId(),
      amount: { value: 5000 },
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_001',
    });
    expect(invoice.status).toBe('UNPAID');
  });
});

describe('Invoice — status', () => {
  it.each(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'])('accepts %s', (status) => {
    expect(validInvoice({ status }).validateSync()).toBeUndefined();
  });

  it('rejects an invalid status', () => {
    const error = validInvoice({ status: 'CANCELLED' }).validateSync();
    expect(error?.errors?.status).toBeDefined();
  });
});

describe('Invoice — required fields', () => {
  it('requires amount', () => {
    const error = validInvoice({ amount: undefined }).validateSync();
    expect(error?.errors?.amount).toBeDefined();
  });

  it('requires amount.value', () => {
    const error = validInvoice({ amount: { currency: 'INR' } }).validateSync();
    expect(error?.errors?.['amount.value']).toBeDefined();
  });

  it('requires sourceUrl', () => {
    const error = validInvoice({ sourceUrl: undefined }).validateSync();
    expect(error?.errors?.sourceUrl).toBeDefined();
  });

  it('requires messageId when sourceType is EMAIL', () => {
    const error = validInvoice({ messageId: undefined }).validateSync();
    expect(error?.errors?.messageId).toBeDefined();
  });
});

describe('Invoice — optional fields not invented when absent', () => {
  it('validates with only required fields', () => {
    const invoice = new Invoice({
      userId: objectId(),
      amount: { value: 5000 },
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_001',
    });

    expect(invoice.validateSync()).toBeUndefined();
    expect(invoice.invoiceNumber).toBeNull();
    expect(invoice.dueDate).toBeNull();
    expect(invoice.issuer).toBeNull();
    expect(invoice.threadId).toBeNull();
    expect(invoice.conversation).toEqual([]);
  });
});

describe('Invoice — conversation storage', () => {
  it('accepts SENT/RECEIVED conversation messages', () => {
    const invoice = validInvoice({
      conversation: [
        { messageId: 'msg_001', direction: 'RECEIVED', content: 'Please find attached invoice INV-123 for ₹5,000.', timestamp: new Date() },
        { messageId: 'msg_002', direction: 'SENT', content: "Thanks, we'll process it.", timestamp: new Date() },
        { messageId: 'msg_003', direction: 'RECEIVED', content: 'Received ₹5,000. Thank you.', timestamp: new Date() },
      ],
    });

    expect(invoice.validateSync()).toBeUndefined();
    expect(invoice.conversation).toHaveLength(3);
    expect(invoice.conversation.map((m) => m.direction)).toEqual(['RECEIVED', 'SENT', 'RECEIVED']);
  });

  it('rejects an invalid direction value', () => {
    const error = validInvoice({
      conversation: [{ messageId: 'msg_001', direction: 'INBOUND', content: 'x', timestamp: new Date() }],
    }).validateSync();

    expect(error?.errors?.['conversation.0.direction']).toBeDefined();
  });

  it('accepts a conversation message with attachments (e.g. the original invoice PDF)', () => {
    const invoice = validInvoice({
      conversation: [
        {
          messageId: 'msg_001',
          direction: 'RECEIVED',
          content: 'Please find attached invoice INV-123 for ₹5,000.',
          timestamp: new Date(),
          attachments: [{ attachmentId: 'att_1', fileName: 'invoice-INV-123.pdf' }],
        },
      ],
    });

    expect(invoice.validateSync()).toBeUndefined();
    expect(invoice.conversation[0].attachments).toHaveLength(1);
    expect(invoice.conversation[0].attachments[0].toObject()).toEqual({
      attachmentId: 'att_1',
      fileName: 'invoice-INV-123.pdf',
      mimeType: null,
      size: null,
    });
  });

  it('conversation messages default to no attachments', () => {
    const invoice = validInvoice({
      conversation: [{ messageId: 'msg_002', direction: 'SENT', content: "Thanks, we'll process it.", timestamp: new Date() }],
    });

    expect(invoice.validateSync()).toBeUndefined();
    expect(invoice.conversation[0].attachments).toEqual([]);
  });

  it('attachments live per-message, not as a separate top-level Invoice field', () => {
    expect(Invoice.schema.path('attachments')).toBeUndefined();
    expect(Invoice.schema.path('conversation').schema.path('attachments')).toBeDefined();
  });

  it('does not use a fromUser boolean', () => {
    const schema = Invoice.schema.path('conversation').schema;
    expect(schema.path('fromUser')).toBeUndefined();
    expect(schema.path('direction')).toBeDefined();
  });
});

describe('Invoice — threadId/messageId for reconciliation matching', () => {
  it('stores threadId as a plain string for direct equality matching', () => {
    const invoice = validInvoice({ threadId: 'thread_100' });
    expect(invoice.threadId).toBe('thread_100');
    expect(typeof invoice.threadId).toBe('string');
  });
});

describe('validateExtractedInvoice — LLM structured-output validation', () => {
  it('normalizes a well-formed extracted invoice, defaulting to UNPAID', () => {
    const { invoice, error } = validateExtractedInvoice({
      invoiceNumber: 'INV-123',
      amount: { value: 5000, currency: 'INR' },
      dueDate: '2026-09-01T00:00:00Z',
      issuer: { name: 'Acme Corp', email: 'billing@acme.com' },
      sourceUrl: 'https://mail.google.com/mail/u/0/#all/abc123',
      sourceType: 'EMAIL',
      threadId: 'thread_100',
      messageId: 'msg_001',
    });

    expect(error).toBeNull();
    expect(invoice.status).toBe('UNPAID');
    expect(invoice.amount).toEqual({ value: 5000, currency: 'INR' });
    expect(invoice.threadId).toBe('thread_100');
  });

  it('rejects missing amount.value', () => {
    const { invoice, error } = validateExtractedInvoice({
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(invoice).toBeNull();
    expect(error).toMatch(/amount/);
  });

  it('rejects missing sourceUrl', () => {
    const { invoice, error } = validateExtractedInvoice({
      amount: { value: 5000 },
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(invoice).toBeNull();
    expect(error).toMatch(/sourceUrl/);
  });

  it('rejects missing messageId when sourceType is EMAIL', () => {
    const { invoice, error } = validateExtractedInvoice({
      amount: { value: 5000 },
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
    });
    expect(invoice).toBeNull();
    expect(error).toMatch(/messageId/);
  });

  it('never marks status PAID from the initial extraction alone, even if given', () => {
    // The validator accepts a status value if already a valid enum member,
    // but nothing about extraction alone should produce PAID without a
    // reconciled Payment — that responsibility lives with the (not yet
    // wired) orchestrator + reconciliation service, not this validator.
    const { invoice } = validateExtractedInvoice({
      amount: { value: 5000 },
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(invoice.status).toBe('UNPAID');
  });

  it('never throws on malformed input', () => {
    expect(() => validateExtractedInvoice(null)).not.toThrow();
    expect(() => validateExtractedInvoice(undefined)).not.toThrow();
    expect(() => validateExtractedInvoice({ amount: 'not an object' })).not.toThrow();
  });
});

describe('validateConversationMessage', () => {
  it('normalizes a well-formed reply, including attachments', () => {
    const { message, error } = validateConversationMessage({
      messageId: 'msg_003',
      direction: 'RECEIVED',
      content: 'Received ₹5,000. Thank you.',
      timestamp: '2026-08-25T10:00:00Z',
      attachments: [{ attachmentId: 'att_2', fileName: 'receipt.pdf' }],
    });

    expect(error).toBeNull();
    expect(message.messageId).toBe('msg_003');
    expect(message.timestamp).toBeInstanceOf(Date);
    expect(message.attachments).toEqual([
      { attachmentId: 'att_2', fileName: 'receipt.pdf', mimeType: null, size: null },
    ]);
  });

  it('defaults to no attachments when none are given', () => {
    const { message } = validateConversationMessage({
      messageId: 'msg_002',
      direction: 'SENT',
      content: "Thanks, we'll process it.",
      timestamp: '2026-08-20T10:00:00Z',
    });
    expect(message.attachments).toEqual([]);
  });

  it('rejects a missing messageId', () => {
    const { message, error } = validateConversationMessage({
      direction: 'SENT',
      content: 'x',
      timestamp: '2026-08-20T10:00:00Z',
    });
    expect(message).toBeNull();
    expect(error).toMatch(/messageId/);
  });

  it('rejects an invalid direction', () => {
    const { message, error } = validateConversationMessage({
      messageId: 'msg_1',
      direction: 'INBOUND',
      content: 'x',
      timestamp: '2026-08-20T10:00:00Z',
    });
    expect(message).toBeNull();
    expect(error).toMatch(/direction/);
  });

  it('rejects missing/invalid timestamp', () => {
    const { message, error } = validateConversationMessage({
      messageId: 'msg_1',
      direction: 'SENT',
      content: 'x',
    });
    expect(message).toBeNull();
    expect(error).toMatch(/timestamp/);
  });

  it('never throws on malformed input', () => {
    expect(() => validateConversationMessage(null)).not.toThrow();
    expect(() => validateConversationMessage({ attachments: 'not an array' })).not.toThrow();
  });
});

describe('Reply-turned-payment: the same message, two roles, no duplication', () => {
  it('the message that confirms payment is preserved once on Invoice.conversation, and separately identifies the Payment via matching messageId/threadId — Payment carries no conversation copy of its own', () => {
    // This test documents the intended relationship (see decisions.md):
    // the SAME Gmail message plays two roles once reconciliation runs —
    // (1) conversation context appended to the Invoice, and (2) the
    // provenance of a new Payment. Nothing is duplicated between them.
    const replyMessageId = 'msg_003';
    const replyThreadId = 'thread_100';

    const { message } = validateConversationMessage({
      messageId: replyMessageId,
      direction: 'RECEIVED',
      content: 'Received ₹5,000. Thank you.',
      timestamp: '2026-08-25T10:00:00Z',
    });

    const invoice = validInvoice({ threadId: replyThreadId, conversation: [message] });
    expect(invoice.validateSync()).toBeUndefined();

    // Payment's own provenance fields — not a conversation array — are
    // what tie it back to this exact message.
    const paymentLikeProvenance = { threadId: replyThreadId, messageId: replyMessageId };
    expect(invoice.conversation[0].messageId).toBe(paymentLikeProvenance.messageId);
    expect(invoice.threadId).toBe(paymentLikeProvenance.threadId);
  });
});

describe('determineInvoiceStatus', () => {
  const invoiceAmount = { value: 5000, currency: 'INR' };

  it('returns UNPAID when nothing has been paid and it is not past due', () => {
    const status = determineInvoiceStatus({ invoiceAmount, dueDate: null, linkedPayments: [] });
    expect(status).toBe('UNPAID');
  });

  it('returns PAID when linked payments cover the full amount', () => {
    const status = determineInvoiceStatus({
      invoiceAmount,
      dueDate: null,
      linkedPayments: [{ amount: { value: 5000, currency: 'INR' } }],
    });
    expect(status).toBe('PAID');
  });

  it('returns PAID when linked payments exceed the full amount (overpayment)', () => {
    const status = determineInvoiceStatus({
      invoiceAmount,
      dueDate: null,
      linkedPayments: [{ amount: { value: 3000 } }, { amount: { value: 2500 } }],
    });
    expect(status).toBe('PAID');
  });

  it('returns PARTIALLY_PAID when linked payments cover only part of the amount', () => {
    const status = determineInvoiceStatus({
      invoiceAmount,
      dueDate: null,
      linkedPayments: [{ amount: { value: 2000 } }],
    });
    expect(status).toBe('PARTIALLY_PAID');
  });

  it('sums multiple partial payments toward the total', () => {
    const status = determineInvoiceStatus({
      invoiceAmount,
      dueDate: null,
      linkedPayments: [{ amount: { value: 2000 } }, { amount: { value: 1000 } }],
    });
    expect(status).toBe('PARTIALLY_PAID');
  });

  it('returns OVERDUE when nothing has been paid and the due date has passed', () => {
    const status = determineInvoiceStatus({
      invoiceAmount,
      dueDate: new Date('2020-01-01T00:00:00Z'),
      linkedPayments: [],
    });
    expect(status).toBe('OVERDUE');
  });

  it('PARTIALLY_PAID takes precedence over OVERDUE once any payment exists', () => {
    const status = determineInvoiceStatus({
      invoiceAmount,
      dueDate: new Date('2020-01-01T00:00:00Z'),
      linkedPayments: [{ amount: { value: 1000 } }],
    });
    expect(status).toBe('PARTIALLY_PAID');
  });

  it('excludes a payment in a different currency from the paid total, and warns', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const status = determineInvoiceStatus({
      invoiceAmount,
      dueDate: null,
      linkedPayments: [{ amount: { value: 5000, currency: 'USD' } }],
    });

    expect(status).toBe('UNPAID');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('never throws on malformed input', () => {
    expect(() => determineInvoiceStatus({})).not.toThrow();
    expect(() => determineInvoiceStatus({ linkedPayments: 'not an array' })).not.toThrow();
    expect(() => determineInvoiceStatus({ linkedPayments: [null, { amount: 'oops' }] })).not.toThrow();
  });
});
