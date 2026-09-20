import { describe, expect, it } from 'vitest';
import { collectGmailHistoryMessageIds } from '@/lib/gmail';

describe('collectGmailHistoryMessageIds', () => {
  it('dedupes messageAdded ids and keeps order', () => {
    const ids = collectGmailHistoryMessageIds({
      historyId: '99',
      history: [
        { messagesAdded: [{ message: { id: 'a' } }, { message: { id: 'b' } }] },
        { messagesAdded: [{ message: { id: 'a' } }, { message: { id: 'c' } }] },
      ],
    });
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('returns empty when history is missing', () => {
    expect(collectGmailHistoryMessageIds({ historyId: '1' })).toEqual([]);
    expect(collectGmailHistoryMessageIds({})).toEqual([]);
  });
});
