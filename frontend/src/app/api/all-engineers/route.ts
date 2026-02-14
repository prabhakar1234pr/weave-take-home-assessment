import { NextResponse } from 'next/server';
import { getGitHubData } from '@/lib/github';
import { analyzeEngineers, getDataDateRange, generateInsights } from '@/lib/analyzer';

export const revalidate = 300; // ISR: cache at edge for 5 min, revalidate in background

export async function GET() {
  try {
    const data = await getGitHubData();
    const engineers = analyzeEngineers(data.contributors, data.prs);
    const dateRange = getDataDateRange(data.prs);
    const insights = generateInsights(engineers, data.contributors);
    return NextResponse.json({
      engineers,
      dateRange,
      insights,
      fetchedAt: data.fetched_at,
      totalPRs: data.prs.length,
    });
  } catch (error) {
    console.error('All-engineers API error:', error);
    return NextResponse.json({
      engineers: [],
      dateRange: { from: '', to: '', months: 0 },
      insights: [],
      fetchedAt: null,
      totalPRs: 0,
    });
  }
}
