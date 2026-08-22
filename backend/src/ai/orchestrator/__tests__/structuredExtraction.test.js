jest.mock('../../client', () => ({ generate: jest.fn() }));

const aiClient = require('../../client');
const { runStructuredExtraction, parseStructuredResponse } = require('../structuredExtraction');

describe('structuredExtraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseStructuredResponse', () => {
    it('strips markdown code fences before parsing', () => {
      const { data, error } = parseStructuredResponse('```json\n{"found": true, "amount": {"value": 5}}\n```');
      expect(error).toBeNull();
      expect(data).toEqual({ amount: { value: 5 } });
    });

    it('treats {"found": false} as "nothing found", not an error', () => {
      const { data, error } = parseStructuredResponse('{"found": false}');
      expect(data).toBeNull();
      expect(error).toBeNull();
    });

    it('returns an error on malformed JSON', () => {
      const { data, error } = parseStructuredResponse('not json at all');
      expect(data).toBeNull();
      expect(error).toMatch(/Failed to parse/);
    });

    it('strips the "found" flag out of the returned fields', () => {
      const { data } = parseStructuredResponse('{"found": true, "invoiceNumber": "INV-1"}');
      expect(data).toEqual({ invoiceNumber: 'INV-1' });
      expect(data).not.toHaveProperty('found');
    });
  });

  describe('runStructuredExtraction', () => {
    it('returns an error for a type with no configured prompt builder', async () => {
      // All 5 real Entity types (INVOICE/PAYMENT/EVENT/TICKET/DOCUMENT) have
      // a configured prompt builder — use a nonexistent type to exercise
      // this fallback path.
      const { data, error } = await runStructuredExtraction('some text', 'UNKNOWN_TYPE');
      expect(data).toBeNull();
      expect(error).toMatch(/No extraction prompt configured/);
      expect(aiClient.generate).not.toHaveBeenCalled();
    });

    it('skips the AI call entirely for empty text', async () => {
      const { data, error } = await runStructuredExtraction('   ', 'INVOICE');
      expect(data).toBeNull();
      expect(error).toBeNull();
      expect(aiClient.generate).not.toHaveBeenCalled();
    });

    it('builds the type-specific prompt and passes {feature, type} to the AI client', async () => {
      aiClient.generate.mockResolvedValue('{"found": true, "amount": {"value": 100, "currency": "USD"}}');

      const { data } = await runStructuredExtraction('Invoice for $100', 'INVOICE');

      expect(data).toEqual({ amount: { value: 100, currency: 'USD' } });
      const [prompt, options] = aiClient.generate.mock.calls[0];
      expect(prompt).toContain('Invoice for $100');
      expect(options).toEqual({ feature: 'extractEntities', type: 'INVOICE' });
    });
  });
});
