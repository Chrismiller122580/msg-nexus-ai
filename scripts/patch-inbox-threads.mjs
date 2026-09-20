#!/usr/bin/env node
/** Idempotent source patch: wire thread grouping into InboxClient.tsx. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'app/inbox/InboxClient.tsx');
let text = readFileSync(file, 'utf8');

if (text.includes('groupRankedByThread')) {
  console.log('✓ InboxClient already has thread grouping');
  process.exit(0);
}

const importNeedle = "import { Message, Insight, PlatformId, Category, RankedMessage } from '../../lib/types';";
const importInsert =
  importNeedle +
  "\nimport { groupRankedByThread } from '../../lib/message-threads';\nimport { ThreadCountChip, ThreadRail } from './InboxThreadBits';";
if (!text.includes(importNeedle)) {
  console.error('patch-inbox-threads: import needle missing');
  process.exit(1);
}
text = text.replace(importNeedle, importInsert);

const selectedNeedle = `  const selectedMessage = useMemo(() => {
    if (!selectedMessageId) return null;
    return messages.find(m => m.id === selectedMessageId) || null;
  }, [selectedMessageId, messages]);`;
const selectedInsert =
  selectedNeedle +
  `

  const threaded = useMemo(() => {
    if (debouncedQuery.trim()) {
      return ranked.map((r) => ({
        key: r.message.id,
        latest: r,
        count: 1,
        members: [r],
      }));
    }
    return groupRankedByThread(ranked);
  }, [ranked, debouncedQuery]);

  const selectedThreadMembers = useMemo(() => {
    if (!selectedMessageId) return [];
    const hit = threaded.find((t) => t.members.some((m) => m.message.id === selectedMessageId));
    return hit ? hit.members.map((m) => m.message) : [];
  }, [threaded, selectedMessageId]);`;
if (!text.includes(selectedNeedle)) {
  console.error('patch-inbox-threads: selectedMessage needle missing');
  process.exit(1);
}
text = text.replace(selectedNeedle, selectedInsert);

const mapNeedle = `                  {ranked.map(({ message, score, insight }) => {
                    const badge = getMessageBadge(message);
                    const isActive = selectedMessageId === message.id;`;
const mapInsert = `                  {threaded.map(({ key, latest, count, members }) => {
                    const { message, score, insight } = latest;
                    const badge = getMessageBadge(message);
                    const isActive = members.some((m) => m.message.id === selectedMessageId);`;
if (!text.includes(mapNeedle)) {
  console.error('patch-inbox-threads: ranked.map needle missing');
  process.exit(1);
}
text = text.replace(mapNeedle, mapInsert);
text = text.replace('                        key={message.id}', '                        key={key}');

const timeNeedle = `                              <span className="shrink-0">{formatRelativeTime(message.timestamp)}</span>
                              {debouncedQuery && (`;
const timeInsert = `                              <span className="shrink-0">{formatRelativeTime(message.timestamp)}</span>
                              <ThreadCountChip count={count} />
                              {debouncedQuery && (`;
if (!text.includes(timeNeedle)) {
  console.error('patch-inbox-threads: timestamp needle missing');
  process.exit(1);
}
text = text.replace(timeNeedle, timeInsert);

const bodyNeedle = `      <div className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/60 p-4 rounded-2xl border border-border break-words">
        {selectedMessage.body}
      </div>`;
const bodyInsert =
  bodyNeedle +
  `

      <ThreadRail
        members={selectedThreadMembers}
        selectedId={selectedMessage.id}
        onSelect={selectMessage}
      />`;
if (!text.includes(bodyNeedle)) {
  console.error('patch-inbox-threads: body needle missing');
  process.exit(1);
}
text = text.replace(bodyNeedle, bodyInsert);

writeFileSync(file, text);
console.log('✓ Patched InboxClient.tsx with thread grouping');
