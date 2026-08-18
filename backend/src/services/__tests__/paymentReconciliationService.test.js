const { findMatchingInvoice, scoreMatch, determineLinkMethod, MATCH_THRESHOLD } = require('../paymentReconciliationService');

describe('findMatchingInvoice — spec scenarios', () => {
  it('matches via same-thread + exact-amount (the "payment confirmation reply in the same thread" case)', () => {
    // Exactly the spec's worked example: Invoice inv_123, ₹5,000, thread_100;
    // new email "Received ₹5,000!! Thank you." in the same thread.
    const invoice = {
      id: 'inv_123',
      invoiceNumber: 'INV-123',
      amount: { value: 5000, currency: 'INR' },
      threadId: 'thread_100',
      issuer: null,
    };

    const evidence = {
      amount: { value: 5000, currency: 'INR' },
      threadId: 'thread_100',
    };

    const result = findMatchingInvoice(evidence, [invoice]);
    expect(result).not.toBeNull();
    expect(result.invoice.id).toBe('inv_123');
    expect(result.matchedSignals).toEqual(expect.arrayContaining(['same_thread', 'exact_amount']));
  });

  it('does NOT match on amount alone (the bank-confirmation, different-thread case with no other evidence)', () => {
    // Spec: "Do not blindly link a Payment to an Invoice based only on amount."
    const invoice = {
      id: 'inv_123',
      invoiceNumber: 'INV-123',
      amount: { value: 5000, currency: 'INR' },
      threadId: 'thread_100',
      issuer: { name: 'Acme Corporation' },
    };

    const evidence = {
      // Different thread (bank email), no invoice number, no matching payee name.
      amount: { value: 5000, currency: 'INR' },
      threadId: 'thread_999',
    };

    const result = findMatchingInvoice(evidence, [invoice]);
    expect(result).toBeNull();
  });

  it('matches via an exact invoice number alone, even across different threads', () => {
    const invoice = {
      id: 'inv_123',
      invoiceNumber: 'INV-123',
      amount: { value: 5000, currency: 'INR' },
      threadId: 'thread_100',
    };

    const evidence = {
      invoiceNumber: 'inv-123', // case-insensitive
      amount: { value: 5000 },
      threadId: 'thread_999', // bank email, unrelated thread
    };

    const result = findMatchingInvoice(evidence, [invoice]);
    expect(result).not.toBeNull();
    expect(result.matchedSignals).toContain('exact_invoice_number');
  });

  it('matches via exact amount + payee-matches-issuer together (two corroborating signals, no thread/invoice number)', () => {
    const invoice = {
      id: 'inv_123',
      amount: { value: 5000, currency: 'INR' },
      issuer: { name: 'Acme Corporation', email: 'billing@acme.com' },
    };

    const evidence = {
      amount: { value: 5000, currency: 'INR' },
      payee: { email: 'billing@acme.com' },
    };

    const result = findMatchingInvoice(evidence, [invoice]);
    expect(result).not.toBeNull();
    expect(result.matchedSignals).toEqual(expect.arrayContaining(['exact_amount', 'payee_matches_issuer']));
  });

  it('picks the highest-scoring candidate among several', () => {
    const weakMatch = {
      id: 'inv_weak',
      amount: { value: 5000 },
      threadId: 'thread_100',
    };
    const strongMatch = {
      id: 'inv_strong',
      invoiceNumber: 'INV-123',
      amount: { value: 5000 },
      threadId: 'thread_100',
    };

    const evidence = { invoiceNumber: 'INV-123', amount: { value: 5000 }, threadId: 'thread_100' };

    const result = findMatchingInvoice(evidence, [weakMatch, strongMatch]);
    expect(result.invoice.id).toBe('inv_strong');
  });

  it('a currency mismatch on an otherwise-equal amount disqualifies the amount signal', () => {
    const invoice = { id: 'inv_1', amount: { value: 5000, currency: 'USD' }, threadId: 'thread_100' };
    const evidence = { amount: { value: 5000, currency: 'INR' }, threadId: 'thread_100' };

    // same_thread (0.3) alone is below threshold once exact_amount is disqualified.
    const result = findMatchingInvoice(evidence, [invoice]);
    expect(result).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    expect(findMatchingInvoice({ amount: { value: 5000 } }, [])).toBeNull();
  });

  it('never throws on malformed evidence or candidates', () => {
    expect(() => findMatchingInvoice(null, [])).not.toThrow();
    expect(() => findMatchingInvoice(undefined, undefined)).not.toThrow();
    expect(() => findMatchingInvoice({}, [{}, null, { amount: 'oops' }])).not.toThrow();
  });
});

describe('scoreMatch — determinism', () => {
  it('is a pure function — same input always produces the same score', () => {
    const invoice = { invoiceNumber: 'INV-1', amount: { value: 100 }, threadId: 't1' };
    const evidence = { invoiceNumber: 'INV-1', amount: { value: 100 }, threadId: 't1' };

    const results = Array.from({ length: 5 }, () => scoreMatch(evidence, invoice));
    results.forEach((r) => expect(r).toEqual(results[0]));
  });

  it('MATCH_THRESHOLD is exported and used consistently', () => {
    expect(typeof MATCH_THRESHOLD).toBe('number');
    expect(MATCH_THRESHOLD).toBeGreaterThan(0);
    expect(MATCH_THRESHOLD).toBeLessThanOrEqual(1);
  });
});

describe('determineLinkMethod', () => {
  it('returns THREAD_CONTEXT when the same_thread signal contributed to the match (the "reply in the same thread" case)', () => {
    const matchResult = { invoice: {}, score: 0.65, matchedSignals: ['same_thread', 'exact_amount'] };
    expect(determineLinkMethod(matchResult)).toBe('THREAD_CONTEXT');
  });

  it('returns RECONCILED when the match happened without same_thread (the "bank email" case)', () => {
    const matchResult = { invoice: {}, score: 1.0, matchedSignals: ['exact_invoice_number'] };
    expect(determineLinkMethod(matchResult)).toBe('RECONCILED');
  });

  it('returns null when there was no match', () => {
    expect(determineLinkMethod(null)).toBeNull();
  });
});
