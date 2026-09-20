import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupRankedByThread } from '../lib/message-threads';
import type { Message, RankedMessage } from '../lib/types';

function row(partial: Partial<Message> & Pick<Message, 'id'>): RankedMessage {
  const message: Message = {
    platformId: 'email',
    timestamp: '2026-01-02T00:00:00.000Z',
    from: 'a@x.com',
    body: 'hi',
    ...partial,
  };
  return { message, score: 1 };
}

describe('groupRankedByThread', () => {
  it('collapses the same threadKey and keeps newest first', () => {
    const grouped = groupRankedByThread([
      row({ id: '1', threadKey: 's:a@x.com:lease', timestamp: '2026-01-01T00:00:00.000Z', body: 'old' }),
      row({ id: '2', threadKey: 's:a@x.com:lease', timestamp: '2026-01-03T00:00:00.000Z', body: 'new' }),
      row({ id: '3', timestamp: '2026-01-04T00:00:00.000Z', body: 'solo' }),
    ]);
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].count, 2);
    assert.equal(grouped[0].latest.message.id, '2');
    assert.equal(grouped[1].latest.message.id, '3');
  });
});
