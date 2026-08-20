jest.mock('../../client', () => ({ generate: jest.fn() }));

const aiClient = require('../../client');
const { summarizeBody } = require('../textSummaryProcessor');

describe('textSummaryProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns "" without calling the AI for empty/whitespace-only body text', async () => {
    expect(await summarizeBody('')).toBe('');
    expect(await summarizeBody('   ')).toBe('');
    expect(await summarizeBody(null)).toBe('');
    expect(aiClient.generate).not.toHaveBeenCalled();
  });

  it('calls the AI with feature=summarizeEmail and returns the parsed summary', async () => {
    aiClient.generate.mockResolvedValue('{"summary": "Vendor sent an invoice for $500."}');

    const summary = await summarizeBody('Please find attached your invoice for $500.');

    expect(summary).toBe('Vendor sent an invoice for $500.');
    const [prompt, options] = aiClient.generate.mock.calls[0];
    expect(prompt).toContain('Please find attached your invoice for $500.');
    expect(options).toEqual({ feature: 'summarizeEmail' });
  });

  it('returns "" (never throws) when the AI response is not valid JSON', async () => {
    aiClient.generate.mockResolvedValue('not json');
    const summary = await summarizeBody('some body text');
    expect(summary).toBe('');
  });
});
