import { NextResponse } from 'next/server';
import { getGitHubData } from '@/lib/github';
import { analyzeEngineers, getDataDateRange } from '@/lib/analyzer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getGitHubData();
    const engineers = analyzeEngineers(data.contributors, data.prs);
    const dateRange = getDataDateRange(data.prs);
    return NextResponse.json({ engineers, dateRange });
  } catch (error) {
    console.error('All-engineers API error:', error);
    return NextResponse.json({ engineers: [], dateRange: { from: '', to: '', months: 0 } });
  }
}
