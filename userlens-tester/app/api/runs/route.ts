import { NextResponse } from 'next/server';
import { listRuns } from '@/lib/store';

export async function GET() {
  return NextResponse.json({ runs: listRuns() });
}