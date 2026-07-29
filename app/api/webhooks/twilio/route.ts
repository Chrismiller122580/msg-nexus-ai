import { NextResponse } from 'next/server';
import { getDb, twilioConnections } from '@/db';
import { phonesMatch, validateTwilioSignatureForRequest } from '@/lib/twilio';
import { getTwilioAutoReplyMessage, twimlEmptyResponse, twimlMessageResponse } from '@/lib/twilio-twiml';
import { ingestTwilioWebhookMessage } from '@/lib/twilio-sync';

function twimlResponse(body: string) {
  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    params[key] = String(value);
  }

  const signature = request.headers.get('x-twilio-signature');

  if (!validateTwilioSignatureForRequest(signature, request, params)) {
    console.error('[twilio-webhook] signature validation failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const messageSid = params.MessageSid;
  const from = params.From;
  const body = params.Body;
  const to = params.To;

  if (!messageSid || !from) {
    return twimlResponse(twimlEmptyResponse());
  }

  const db = getDb();
  const connections = await db.select().from(twilioConnections);
  let ingested = false;

  for (const conn of connections) {
    const matchesUser =
      connections.length === 1 ||
      (to && phonesMatch(to, conn.phoneNumber)) ||
      phonesMatch(from, conn.phoneNumber);

    if (!matchesUser) continue;

    await ingestTwilioWebhookMessage(conn.userId, {
      MessageSid: messageSid,
      From: from,
      To: to,
      Body: body || '',
      DateCreated: params.DateCreated,
      direction: 'in',
      status: 'received',
    });
    try {
      const { notifyNewMessage } = await import('@/lib/push');
      await notifyNewMessage(conn.userId, {
        platform: 'SMS',
        from,
        preview: body || '(empty SMS)',
        messageId: `twilio-${conn.id}-${messageSid}`,
      });
    } catch (err) {
      console.warn('[twilio-webhook] push notify failed', err);
    }
    ingested = true;
    break;
  }

  if (!ingested) {
    console.warn('[twilio-webhook] no matching twilio connection for To=', to, 'From=', from);
  }

  const autoReply = getTwilioAutoReplyMessage();
  if (ingested && autoReply) {
    return twimlResponse(twimlMessageResponse(autoReply));
  }

  return twimlResponse(twimlEmptyResponse());
}
