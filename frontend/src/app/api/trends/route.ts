import { NextRequest, NextResponse } from 'next/server';
import { getGitHubData } from '@/lib/github';
import { generateTrends } from '@/lib/analyzer';

export const revalidate = 300;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const top = Math.min(parseInt(searchParams.get('top') || '5', 10), 10);
    const from = searchParams.get('from'); // ISO date string
    const to = searchParams.get('to');     // ISO date string

    const data = await getGitHubData();

    // Filter PRs by date range if provided
    let filteredPRs = data.prs;
    if (from) filteredPRs = filteredPRs.filter((pr) => pr.merged_at >= from);
    if (to) filteredPRs = filteredPRs.filter((pr) => pr.merged_at <= to);

    // Show top 5 of the selected time range
    const trends = generateTrends(filteredPRs, data.contributors, top, undefined, from || undefined);
    return NextResponse.json(trends, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Trends API error:', error);
    return NextResponse.json({ engineers: [], series: [] });
  }
}
