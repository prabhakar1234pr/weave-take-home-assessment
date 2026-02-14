import { NextRequest, NextResponse } from 'next/server';
import { getGitHubData } from '@/lib/github';
import { analyzeTopEngineers } from '@/lib/analyzer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 20);

    const data = await getGitHubData();
    const engineers = analyzeTopEngineers(data.contributors, data.prs, limit);
    return NextResponse.json(engineers);
  } catch (error) {
    console.error('Top-engineers API error:', error);
    return NextResponse.json([]);
  }
}
