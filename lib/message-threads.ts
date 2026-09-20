import type { Message, RankedMessage } from '@/lib/types';

export function messageThreadKey(message: Message): string {
  return message.threadKey || message.id;
}

export function groupRankedByThread(ranked: RankedMessage[]): Array<{
  key: string;
  latest: RankedMessage;
  count: number;
  members: RankedMessage[];
}> {
  const order: string[] = [];
  const buckets = new Map<string, RankedMessage[]>();

  for (const row of ranked) {
    const key = messageThreadKey(row.message);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(row);
  }

  return order.map((key) => {
    const members = [...buckets.get(key)!].sort(
      (a, b) =>
        new Date(b.message.timestamp).getTime() - new Date(a.message.timestamp).getTime()
    );
    return { key, latest: members[0], count: members.length, members };
  });
}
