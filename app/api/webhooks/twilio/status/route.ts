import { NextResponse } from 'next/server';
import { validateTwilioSignature } from '@/lib/twilio';
import { getAppUrl } from '@/lib/app-url';
import { updateSmsStatusBySid, type SmsStatus } from '@/lib/sms-store';

function mapTwilioStatus(status: string): SmsStatus | null {
  switch (status) {
    case 'queued':
    case 'sending':
      return 'queued';
    case 'sent':
    case 'delivered':
      return 'sent';
    case 'failed':
    case 'undelivered':
      return 'failed';
    case 'received':
      return 'received';
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    params[key] = String(value);
  }

  const signature = request.headers.get('x-twilio-signature');
  const url = `${getAppUrl()}/api/webhooks/twilio/status`;

  if (process.env.NODE_ENV === 'production' && !validateTwilioSignature(signature, url, params)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const messageSid = params.MessageSid;
  const messageStatus = params.MessageStatus;

  if (messageSid && messageStatus) {
    const status = mapTwilioStatus(messageStatus);
    if (status) {
      await updateSmsStatusBySid(messageSid, status);
    }
  }

  return new NextResponse(null, { status: 204 });
}