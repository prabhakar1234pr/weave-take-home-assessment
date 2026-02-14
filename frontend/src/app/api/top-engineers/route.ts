import { NextRequest, NextResponse } from 'next/server';
import { getTopEngineers } from '@/lib/analyzer';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 20);
  return NextResponse.json(getTopEngineers(limit));
}
