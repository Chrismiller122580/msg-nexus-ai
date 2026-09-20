export type GmailHistoryListPayload = {
  historyId?: string;
  history?: Array<{
    messagesAdded?: Array<{ message?: { id?: string } }>;
  }>;
};

/** Unique message ids from users.history list, first-seen order. */
export function collectGmailHistoryMessageIds(payload: GmailHistoryListPayload): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of payload.history || []) {
    for (const added of entry.messagesAdded || []) {
      const id = added.message?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
