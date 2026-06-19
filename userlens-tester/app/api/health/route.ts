import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'userlens-tester',
    version: '1.0.0',
    tests: ['smoke', 'a11y', 'lighthouse', 'full'],
  });
}