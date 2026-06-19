import { NextResponse } from 'next/server';
import { getDb, messages, insights } from '@/db';
import { validateApiKey } from '@/lib/api-keys';
import { eq, desc, and, inArray } from 'drizzle-orm';

function extractApiKey(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return request.headers.get('x-api-key')?.trim() ?? null;
}

export async function GET(request: Request) {
  const rawKey = extractApiKey(request);
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing API key. Use Authorization: Bearer mnx_... or X-API-Key header.' }, { status: 401 });
  }

  const key = await validateApiKey(rawKey);
  if (!key) {
    return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
  }

  if (!key.scopes.includes('messages:read')) {
    return NextResponse.json({ error: 'Insufficient scope. Required: messages:read' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;
  const platform = searchParams.get('platform');

  const db = getDb();
  const conditions = key.userId ? [eq(messages.userId, key.userId)] : [];
  if (platform) conditions.push(eq(messages.platformId, platform));

  const rows = await db
    .select()
    .from(messages)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(messages.timestamp))
    .limit(limit)
    .offset(offset);

  const messageIds = rows.map((m: (typeof rows)[number]) => m.id);
  let insightRows: (typeof insights.$inferSelect)[] = [];
  if (messageIds.length > 0) {
    insightRows = await db
      .select()
      .from(insights)
      .where(inArray(insights.messageId, messageIds));
  }

  const insightsMap: Record<string, typeof insightRows[number]> = {};
  for (const ins of insightRows) insightsMap[ins.messageId] = ins;

  return NextResponse.json({
    data: rows.map((m: (typeof rows)[number]) => ({
      id: m.id,
      platformId: m.platformId,
      timestamp: m.timestamp,
      from: m.from,
      body: m.body,
      subject: m.subject,
      insight: insightsMap[m.id] ? {
        category: insightsMap[m.id].category,
        amount: insightsMap[m.id].amount ? Number(insightsMap[m.id].amount) : undefined,
        vendor: insightsMap[m.id].vendor,
        summary: insightsMap[m.id].summary,
      } : undefined,
    })),
    pagination: { limit, offset, count: rows.length },
  });
}