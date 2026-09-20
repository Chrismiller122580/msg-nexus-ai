import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectGmailHistoryMessageIds } from '../lib/gmail-history';

describe('collectGmailHistoryMessageIds', () => {
  it('dedupes messageAdded ids and keeps order', () => {
    const ids = collectGmailHistoryMessageIds({
      historyId: '99',
      history: [
        { messagesAdded: [{ message: { id: 'a' } }, { message: { id: 'b' } }] },
        { messagesAdded: [{ message: { id: 'a' } }, { message: { id: 'c' } }] },
      ],
    });
    assert.deepEqual(ids, ['a', 'b', 'c']);
  });

  it('returns empty when history is missing', () => {
    assert.deepEqual(collectGmailHistoryMessageIds({ historyId: '1' }), []);
    assert.deepEqual(collectGmailHistoryMessageIds({}), []);
  });
});
