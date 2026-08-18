const { normalizeEmail, extractDomain } = require('../normalizeEmail');

describe('extractDomain', () => {
  it('extracts the lowercased domain from an email address', () => {
    expect(extractDomain('Billing@AcmeCorp.COM')).toBe('acmecorp.com');
  });

  it('returns an empty string for missing/malformed input', () => {
    expect(extractDomain('')).toBe('');
    expect(extractDomain(null)).toBe('');
    expect(extractDomain(undefined)).toBe('');
    expect(extractDomain('not-an-email')).toBe('');
  });
});

describe('normalizeEmail', () => {
  it('trims fields and lowercases the searchable text', () => {
    const result = normalizeEmail({
      subject: '  Invoice #123  ',
      from: 'Billing@AcmeCorp.com',
      to: 'user@example.com',
      bodyText: '  Amount DUE: $50  ',
    });

    expect(result.subject).toBe('Invoice #123');
    expect(result.from).toBe('Billing@AcmeCorp.com');
    expect(result.fromDomain).toBe('acmecorp.com');
    expect(result.bodyText).toBe('Amount DUE: $50');
    expect(result.searchableText).toBe('invoice #123\namount due: $50');
  });

  it('falls back to snippet when bodyText is missing', () => {
    const result = normalizeEmail({ subject: 'Hi', snippet: 'short preview' });
    expect(result.bodyText).toBe('short preview');
  });

  it('never throws on malformed/empty input', () => {
    expect(() => normalizeEmail()).not.toThrow();
    expect(() => normalizeEmail({})).not.toThrow();
    expect(() => normalizeEmail({ subject: null, from: undefined, bodyText: 12345 })).not.toThrow();

    const result = normalizeEmail({ subject: null, from: undefined, bodyText: 12345 });
    expect(result.subject).toBe('');
    expect(result.from).toBe('');
    expect(result.bodyText).toBe('12345');
  });
});
