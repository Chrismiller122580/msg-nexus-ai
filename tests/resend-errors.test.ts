import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getResendUserMessage } from '../lib/resend-errors';

describe('getResendUserMessage', () => {
  it('explains resend.dev sandbox restriction', () => {
    const msg = getResendUserMessage(
      'You can only send testing emails to your own email address',
      403
    );
    assert.match(msg, /verify msgnexus.ai/i);
  });

  it('explains missing from address', () => {
    const msg = getResendUserMessage('Invalid from field', 422);
    assert.match(msg, /RESEND_FROM_EMAIL/i);
  });
});