import { createHash } from 'node:crypto';

const SUBJECT_PREFIX = /^(re|fw|fwd|aw|sv|rv)\s*:\s*/i;

export function normalizeFrom(from: string): string {
  const trimmed = from.trim().toLowerCase();
  const angle = trimmed.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  const email = trimmed.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  return (email?.[0] || trimmed).replace(/\s+/g, ' ');
}

export function normalizeSubject(subject?: string | null): string {
  let s = (subject || '').trim().toLowerCase();
  while (SUBJECT_PREFIX.test(s)) s = s.replace(SUBJECT_PREFIX, '').trim();
  return s.replace(/\s+/g, ' ');
}

export function normalizeBody(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 400);
}

export function contentFingerprint(input: {
  from: string;
  body: string;
  subject?: string | null;
}): string {
  const raw = [
    normalizeFrom(input.from),
    normalizeSubject(input.subject),
    normalizeBody(input.body),
  ].join('\n');
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export function threadKey(input: {
  from: string;
  subject?: string | null;
  body: string;
}): string {
  const subject = normalizeSubject(input.subject);
  const peer = normalizeFrom(input.from);
  if (subject) return `s:${peer}:${subject}`;
  return `b:${peer}:${normalizeBody(input.body).slice(0, 80)}`;
}
