const { parseFromHeader } = require('../parseEmailAddress');

describe('parseFromHeader', () => {
  it('parses "Display Name <email>" into {name, email}', () => {
    expect(parseFromHeader('Vendor Inc <billing@vendor.com>')).toEqual({
      name: 'Vendor Inc', email: 'billing@vendor.com',
    });
  });

  it('parses a quoted display name', () => {
    expect(parseFromHeader('"Vendor Inc" <billing@vendor.com>')).toEqual({
      name: 'Vendor Inc', email: 'billing@vendor.com',
    });
  });

  it('lowercases the email address', () => {
    expect(parseFromHeader('Vendor Inc <Billing@Vendor.COM>')).toEqual({
      name: 'Vendor Inc', email: 'billing@vendor.com',
    });
  });

  it('treats a bare email address as email-only, no name', () => {
    expect(parseFromHeader('billing@vendor.com')).toEqual({ name: null, email: 'billing@vendor.com' });
  });

  it('falls back to name-only when there is no @ and no angle brackets', () => {
    expect(parseFromHeader('Vendor Inc')).toEqual({ name: 'Vendor Inc', email: null });
  });

  it('returns {name: null, email: null} for empty/non-string input', () => {
    expect(parseFromHeader('')).toEqual({ name: null, email: null });
    expect(parseFromHeader(null)).toEqual({ name: null, email: null });
    expect(parseFromHeader(undefined)).toEqual({ name: null, email: null });
  });
});
