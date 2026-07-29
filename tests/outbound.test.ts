import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canSendPlatform, getSendCapabilities } from '../lib/outbound';

describe('outbound capabilities', () => {
  it('allows sms whatsapp telegram only in v1', () => {
    assert.equal(canSendPlatform('sms'), true);
    assert.equal(canSendPlatform('whatsapp'), true);
    assert.equal(canSendPlatform('telegram'), true);
    assert.equal(canSendPlatform('email'), false);
    assert.equal(canSendPlatform('slack'), false);
  });

  it('marks send only when connected', () => {
    const caps = getSendCapabilities(['sms', 'email']);
    assert.equal(caps.find((c) => c.platform === 'sms')?.canSend, true);
    assert.equal(caps.find((c) => c.platform === 'email')?.canSend, false);
    assert.equal(caps.find((c) => c.platform === 'whatsapp')?.canSend, false);
  });
});
