jest.mock('../../models/EmailThread', () => ({
  findOneAndUpdate: jest.fn(),
}));

const EmailThread = require('../../models/EmailThread');
const { findOrCreateThread, normalizeSubjectForThreading } = require('../threadService');

describe('findOrCreateThread', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    EmailThread.findOneAndUpdate.mockResolvedValue({ _id: 'thread-1' });
  });

  it('requires userId and providerThreadId', async () => {
    await expect(findOrCreateThread({ providerThreadId: 't1' })).rejects.toThrow('userId');
    await expect(findOrCreateThread({ userId: 'u1' })).rejects.toThrow('providerThreadId');
    expect(EmailThread.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('upserts using (userId, provider, providerThreadId) as the lookup key', async () => {
    await findOrCreateThread({
      userId: 'u1',
      providerThreadId: 't1',
      providerMessageId: 'm1',
      subject: 'Unable to login',
    });

    expect(EmailThread.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update, options] = EmailThread.findOneAndUpdate.mock.calls[0];

    expect(filter).toEqual({ userId: 'u1', provider: 'GMAIL', providerThreadId: 't1' });
    expect(update.$setOnInsert).toEqual({
      userId: 'u1',
      provider: 'GMAIL',
      providerThreadId: 't1',
      subject: 'Unable to login',
    });
    expect(update.$addToSet.messageIds).toBe('m1');
    expect(options).toMatchObject({ upsert: true, new: true });
  });

  it('a second message in the same Gmail thread reuses the same filter (no second thread created)', async () => {
    await findOrCreateThread({ userId: 'u1', providerThreadId: 't1', providerMessageId: 'm1', subject: 'Unable to login' });
    await findOrCreateThread({ userId: 'u1', providerThreadId: 't1', providerMessageId: 'm2', subject: 'Re: Unable to login' });

    expect(EmailThread.findOneAndUpdate).toHaveBeenCalledTimes(2);
    const [filter1] = EmailThread.findOneAndUpdate.mock.calls[0];
    const [filter2] = EmailThread.findOneAndUpdate.mock.calls[1];
    expect(filter1).toEqual(filter2);

    const [, update2] = EmailThread.findOneAndUpdate.mock.calls[1];
    expect(update2.$addToSet.messageIds).toBe('m2');
  });

  it('a duplicate webhook for the same message uses $addToSet — idempotent by construction', async () => {
    // $addToSet never duplicates an existing array element; calling this
    // twice with the same providerMessageId always issues the same
    // no-duplicate-producing operator, regardless of how many times it runs.
    await findOrCreateThread({ userId: 'u1', providerThreadId: 't1', providerMessageId: 'm1' });
    await findOrCreateThread({ userId: 'u1', providerThreadId: 't1', providerMessageId: 'm1' });

    const calls = EmailThread.findOneAndUpdate.mock.calls;
    expect(calls[0][1].$addToSet.messageIds).toBe('m1');
    expect(calls[1][1].$addToSet.messageIds).toBe('m1');
  });

  it('deduplicates participants by email (case-insensitive)', async () => {
    await findOrCreateThread({
      userId: 'u1',
      providerThreadId: 't1',
      participants: [
        { email: 'Alice@Example.com', name: 'Alice' },
        { email: 'alice@example.com', name: 'Alice Again' },
        { email: 'bob@example.com', name: 'Bob' },
      ],
    });

    const [, update] = EmailThread.findOneAndUpdate.mock.calls[0];
    expect(update.$addToSet.participants.$each).toEqual([
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com', name: 'Bob' },
    ]);
  });

  it('retries as a plain update (no upsert) when a concurrent call already created the thread', async () => {
    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    EmailThread.findOneAndUpdate
      .mockRejectedValueOnce(duplicateKeyError)
      .mockResolvedValueOnce({ _id: 'thread-1', messageIds: ['m1', 'm2'] });

    const result = await findOrCreateThread({ userId: 'u1', providerThreadId: 't1', providerMessageId: 'm2' });

    expect(EmailThread.findOneAndUpdate).toHaveBeenCalledTimes(2);
    const secondCallOptions = EmailThread.findOneAndUpdate.mock.calls[1][2];
    expect(secondCallOptions).not.toMatchObject({ upsert: true });
    expect(result).toEqual({ _id: 'thread-1', messageIds: ['m1', 'm2'] });
  });

  it('propagates errors that are not a duplicate-key race', async () => {
    EmailThread.findOneAndUpdate.mockRejectedValueOnce(new Error('connection lost'));
    await expect(
      findOrCreateThread({ userId: 'u1', providerThreadId: 't1' })
    ).rejects.toThrow('connection lost');
    expect(EmailThread.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeSubjectForThreading', () => {
  it('strips Re:/RE:/Fwd: prefixes and lowercases', () => {
    expect(normalizeSubjectForThreading('Unable to login')).toBe('unable to login');
    expect(normalizeSubjectForThreading('Re: Unable to login')).toBe('unable to login');
    expect(normalizeSubjectForThreading('RE: Unable to login')).toBe('unable to login');
    expect(normalizeSubjectForThreading('Fwd: Re: Unable to login')).toBe('unable to login');
    expect(normalizeSubjectForThreading('FW: Re: Re: Unable to login')).toBe('unable to login');
  });

  it('handles missing/empty subjects without throwing', () => {
    expect(normalizeSubjectForThreading()).toBe('');
    expect(normalizeSubjectForThreading(null)).toBe('');
    expect(normalizeSubjectForThreading('')).toBe('');
  });

  it('leaves unrelated subjects distinguishable', () => {
    expect(normalizeSubjectForThreading('Invoice #123')).not.toBe(normalizeSubjectForThreading('Unable to login'));
  });
});
