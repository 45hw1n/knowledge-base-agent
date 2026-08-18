jest.mock('../../models/Counter', () => ({
  findOneAndUpdate: jest.fn(),
}));

const Counter = require('../../models/Counter');
const { generateDisplayId, PAD_WIDTH } = require('../displayIdService');

describe('generateDisplayId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds "<PREFIX>-<padded seq>" from the counter result', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ _id: 'user-1:TICKET', seq: 1 });

    const displayId = await generateDisplayId({ userId: 'user-1', type: 'TICKET' });

    expect(displayId).toBe('TKT-001');
  });

  it.each([
    ['TICKET', 'TKT'],
    ['INVOICE', 'INV'],
    ['PAYMENT', 'PAY'],
    ['EVENT', 'EVT'],
    ['DOCUMENT', 'DOC'],
  ])('uses the correct prefix for %s', async (type, prefix) => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 1 });
    const displayId = await generateDisplayId({ userId: 'user-1', type });
    expect(displayId.startsWith(`${prefix}-`)).toBe(true);
  });

  it('pads the sequence number to at least 3 digits', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 7 });
    expect(await generateDisplayId({ userId: 'user-1', type: 'TICKET' })).toBe('TKT-007');
  });

  it('does not truncate — grows beyond the pad width instead of wrapping', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 1000 });
    expect(await generateDisplayId({ userId: 'user-1', type: 'TICKET' })).toBe('TKT-1000');
  });

  it('scopes the counter key to (userId, type) — each gets an independent sequence', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 1 });

    await generateDisplayId({ userId: 'user-1', type: 'TICKET' });
    const [filter] = Counter.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: 'user-1:TICKET' });

    await generateDisplayId({ userId: 'user-2', type: 'TICKET' });
    const [filter2] = Counter.findOneAndUpdate.mock.calls[1];
    expect(filter2).toEqual({ _id: 'user-2:TICKET' });
  });

  it('uses an atomic $inc with upsert — never a read-then-write', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 1 });

    await generateDisplayId({ userId: 'user-1', type: 'TICKET' });

    const [, update, options] = Counter.findOneAndUpdate.mock.calls[0];
    expect(update).toEqual({ $inc: { seq: 1 } });
    expect(options).toMatchObject({ upsert: true, new: true });
  });

  it('rejects an unknown entity type without touching the database', async () => {
    await expect(generateDisplayId({ userId: 'user-1', type: 'UNKNOWN' })).rejects.toThrow(
      'No displayId prefix configured'
    );
    expect(Counter.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a missing userId without touching the database', async () => {
    await expect(generateDisplayId({ type: 'TICKET' })).rejects.toThrow('userId is required');
    expect(Counter.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('PAD_WIDTH is exported and is 3', () => {
    expect(PAD_WIDTH).toBe(3);
  });
});
