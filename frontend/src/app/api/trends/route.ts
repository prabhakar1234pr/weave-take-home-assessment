import { NextRequest, NextResponse } from 'next/server';
import { getGitHubData } from '@/lib/github';
import { generateTrends } from '@/lib/analyzer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const top = Math.min(parseInt(searchParams.get('top') || '5', 10), 10);

    const data = await getGitHubData();
    const trends = generateTrends(data.prs, data.contributors, top);
    return NextResponse.json(trends);
  } catch (error) {
    console.error('Trends API error:', error);
    return NextResponse.json({ engineers: [], series: [] });
  }
}
