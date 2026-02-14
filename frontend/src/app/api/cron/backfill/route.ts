import { NextRequest, NextResponse } from 'next/server';
import { fetchOlderPRs, aggregateRawPRs, setBackfillData } from '@/lib/github';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max on Vercel Pro

// Track whether backfill has reached the first commit
let backfillComplete = false;

/**
 * Background backfill route — fetches older PRs (pre-GH-Archive, pre-2020)
 * via the GitHub API and persists them to Vercel Blob storage.
 *
 * Automatically stops once it has reached the very first commit.
 * Called by Vercel Cron or manually: GET /api/cron/backfill
 */
export async function GET(request: NextRequest) {
  // If backfill already reached the first commit, skip
  if (backfillComplete) {
    return NextResponse.json({
      message: 'Backfill already complete — all PRs from the first commit have been fetched.',
      status: 'done',
    });
  }

  // Verify cron secret in production
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && process.env.NODE_ENV === 'production') {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!process.env.GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_TOKEN not set' }, { status: 500 });
  }

  try {
    const maxPages = parseInt(
      request.nextUrl.searchParams.get('pages') || '50',
      10
    );

    console.log(`[Backfill] Starting — fetching up to ${maxPages * 100} older PRs...`);

    const olderPRs = await fetchOlderPRs(maxPages);

    if (olderPRs.length === 0) {
      backfillComplete = true;
      return NextResponse.json({
        message: 'No more older PRs to fetch — backfill complete.',
        status: 'done',
        count: 0,
      });
    }

    const aggregated = aggregateRawPRs(olderPRs);
    await setBackfillData(aggregated);

    const contributorCount = Object.keys(aggregated.contributors).length;

    // If we got fewer PRs than a full batch, we've reached the end
    if (olderPRs.length < maxPages * 100) {
      backfillComplete = true;
    }

    return NextResponse.json({
      message: backfillComplete
        ? 'Backfill complete — reached the first commit.'
        : 'Backfill batch complete — more to fetch.',
      status: backfillComplete ? 'done' : 'in_progress',
      prs: aggregated.prs.length,
      contributors: contributorCount,
    });
  } catch (error) {
    console.error('[Backfill] Error:', error);
    return NextResponse.json(
      { error: 'Backfill failed', details: String(error) },
      { status: 500 }
    );
  }
}
