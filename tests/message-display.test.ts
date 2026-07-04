import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMessageBadge } from '../lib/message-display';
import type { Message } from '../lib/types';

function msg(id: string, platformId: Message['platformId']): Message {
  return { id, platformId, timestamp: new Date().toISOString(), from: 'test', body: 'hi' };
}

describe('getMessageBadge', () => {
  it('uses Gmail badge for gmail- prefixed ids', () => {
    const badge = getMessageBadge(msg('gmail-abc123', 'email'));
    assert.equal(badge.name, 'Gmail');
    assert.equal(badge.color, '#EA4335');
  });

  it('uses Outlook badge for outlook- prefixed ids', () => {
    const badge = getMessageBadge(msg('outlook-xyz', 'email'));
    assert.equal(badge.name, 'Outlook');
  });

  it('falls back to platform registry for seed messages', () => {
    const badge = getMessageBadge(msg('seed-1', 'whatsapp'));
    assert.equal(badge.name, 'WhatsApp');
  });
});