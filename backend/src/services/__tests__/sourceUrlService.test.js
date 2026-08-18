const { buildSourceUrl } = require('../sourceUrlService');

describe('buildSourceUrl', () => {
  it('builds a Gmail message URL from a provider message id', () => {
    expect(buildSourceUrl({ provider: 'GMAIL', messageId: 'abc123' })).toBe(
      'https://mail.google.com/mail/u/0/#all/abc123'
    );
  });

  it('throws for an unsupported provider rather than guessing a URL', () => {
    expect(() => buildSourceUrl({ provider: 'OUTLOOK', messageId: 'abc123' })).toThrow(
      'Unsupported source provider: OUTLOOK'
    );
  });

  it('throws when messageId is missing', () => {
    expect(() => buildSourceUrl({ provider: 'GMAIL' })).toThrow('messageId is required');
  });
});
