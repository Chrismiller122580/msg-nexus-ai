function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function twimlEmptyResponse(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}

export function twimlMessageResponse(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

export function getTwilioAutoReplyMessage(): string | null {
  const enabled = process.env.TWILIO_AUTO_REPLY === 'true' || process.env.TWILIO_AUTO_REPLY === '1';
  const custom = process.env.TWILIO_AUTO_REPLY_MESSAGE?.trim();
  if (custom) return custom;
  if (enabled) return 'Got it! 📨 This message is now in MsgNexus.';
  return null;
}