/**
 * Scoring engine — calculates multi-dimensional impact scores.
 * All functions accept data as parameters so they work with both
 * live GitHub data and the static JSON fallback.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface ContributorData {
  name: string;
  avatar_url: string;
  prs_created: number;
  total_files_changed: number;
  total_additions: number;
  total_deletions: number;
  avg_time_to_merge_hours: number;
  reviews_given: number;
  prs_reviewed: number;
}

export interface PRData {
  author_username: string;
  title: string;
  files_changed: number;
  additions: number;
  deletions: number;
  time_to_merge_hours: number;
  created_at: string;
  merged_at: string;
  reviews_count: number;
  reviewers: string[];
}

export interface EngineerScore {
  username: string;
  name: string;
  avatar_url: string;
  impact_score: number;
  quality_score: number;
  velocity_score: number;
  collaboration_score: number;
  leadership_score: number;
  stats: {
    prs_created: number;
    reviews_given: number;
    files_changed: number;
    avg_merge_time: number;
  };
}

export interface TrendSeries {
  week: string;
  [username: string]: string | number;
}

export interface TrendResult {
  engineers: { username: string; name: string }[];
  series: TrendSeries[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function getDataWindowMonths(prs: PRData[]): number {
  if (prs.length === 0) return 3;
  const dates = prs
    .map((pr) => new Date(pr.merged_at).getTime())
    .filter((d) => !isNaN(d));
  if (dates.length === 0) return 3;
  const earliest = Math.min(...dates);
  const latest = Math.max(...dates);
  const months = (latest - earliest) / (1000 * 60 * 60 * 24 * 30);
  return Math.max(months, 1);
}

export function getDataDateRange(prs: PRData[]): {
  from: string;
  to: string;
  months: number;
} {
  if (prs.length === 0) return { from: '', to: '', months: 0 };
  const dates = prs
    .map((pr) => new Date(pr.merged_at).getTime())
    .filter((d) => !isNaN(d));
  if (dates.length === 0) return { from: '', to: '', months: 0 };
  const earliest = new Date(Math.min(...dates));
  const latest = new Date(Math.max(...dates));
  const months = Math.round(
    (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return { from: fmt(earliest), to: fmt(latest), months: Math.max(months, 1) };
}

// ── Scoring Functions ────────────────────────────────────────────────

function calculateQualityScore(c: ContributorData): number {
  const mergeTime = Math.min(c.avg_time_to_merge_hours, 72);
  const mergeScore = 100 * (1 - mergeTime / 72);

  const avgChanges =
    (c.total_additions + c.total_deletions) / Math.max(c.prs_created, 1);
  let sizeScore: number;
  if (avgChanges >= 200 && avgChanges <= 500) {
    sizeScore = 100;
  } else if (avgChanges < 200) {
    sizeScore = 50 + (avgChanges / 200) * 50;
  } else {
    sizeScore = Math.max(50, 100 - (avgChanges - 500) / 20);
  }

  const reviewActivity = Math.min(c.reviews_given / 20, 1) * 100;

  return 0.5 * mergeScore + 0.3 * sizeScore + 0.2 * reviewActivity;
}

function calculateVelocityScore(
  c: ContributorData,
  windowMonths: number
): number {
  const prsPerMonth = c.prs_created / windowMonths;
  const consistencyScore = Math.min(prsPerMonth / 10, 1) * 100;

  const avgFiles =
    c.total_files_changed / Math.max(c.prs_created, 1);
  const complexityScore = Math.min(avgFiles / 15, 1) * 100;

  return 0.4 * consistencyScore + 0.6 * complexityScore;
}

function calculateCollaborationScore(c: ContributorData): number {
  const reviewVolume = Math.min(c.reviews_given / 30, 1) * 100;

  let reviewDepth = 0;
  if (c.prs_reviewed > 0) {
    reviewDepth = Math.min(c.reviews_given / c.prs_reviewed / 3, 1) * 100;
  }

  return 0.7 * reviewVolume + 0.3 * reviewDepth;
}

function calculateLeadershipScore(c: ContributorData): number {
  const ownership = Math.min(c.total_files_changed / 200, 1) * 100;

  let balance = 0;
  if (c.prs_created > 0 && c.reviews_given > 0) {
    balance =
      Math.min((c.prs_created + c.reviews_given) / 40, 1) * 100;
  }

  return 0.6 * ownership + 0.4 * balance;
}

function scoreContributor(
  username: string,
  c: ContributorData,
  windowMonths: number
): EngineerScore {
  const quality = calculateQualityScore(c);
  const velocity = calculateVelocityScore(c, windowMonths);
  const collaboration = calculateCollaborationScore(c);
  const leadership = calculateLeadershipScore(c);
  const impact =
    0.3 * quality + 0.3 * velocity + 0.2 * collaboration + 0.2 * leadership;

  return {
    username,
    name: c.name,
    avatar_url: c.avatar_url,
    impact_score: Math.round(impact * 10) / 10,
    quality_score: Math.round(quality * 10) / 10,
    velocity_score: Math.round(velocity * 10) / 10,
    collaboration_score: Math.round(collaboration * 10) / 10,
    leadership_score: Math.round(leadership * 10) / 10,
    stats: {
      prs_created: c.prs_created,
      reviews_given: c.reviews_given,
      files_changed: c.total_files_changed,
      avg_merge_time: c.avg_time_to_merge_hours,
    },
  };
}

// ── Public API ───────────────────────────────────────────────────────

export function analyzeEngineers(
  contributors: Record<string, ContributorData>,
  prs: PRData[]
): EngineerScore[] {
  const windowMonths = getDataWindowMonths(prs);
  const scores: EngineerScore[] = [];

  for (const username of Object.keys(contributors)) {
    const c = contributors[username];
    if (c.prs_created < 2) continue;
    scores.push(scoreContributor(username, c, windowMonths));
  }

  scores.sort((a, b) => b.impact_score - a.impact_score);
  return scores;
}

export function analyzeTopEngineers(
  contributors: Record<string, ContributorData>,
  prs: PRData[],
  limit: number = 5
): EngineerScore[] {
  return analyzeEngineers(contributors, prs).slice(0, limit);
}

/**
 * Generate weekly PR-merge trend data for the top N engineers.
 */
export function generateTrends(
  prs: PRData[],
  contributors: Record<string, ContributorData>,
  top: number = 5
): TrendResult {
  if (prs.length === 0) return { engineers: [], series: [] };

  // Determine top engineers
  const topEngineers = analyzeEngineers(contributors, prs).slice(0, top);
  const topUsernames = new Set(topEngineers.map((e) => e.username));

  // Group PRs by ISO week
  const weekMap: Record<string, Record<string, number>> = {};

  for (const pr of prs) {
    if (!topUsernames.has(pr.author_username)) continue;
    const merged = new Date(pr.merged_at);
    if (isNaN(merged.getTime())) continue;

    const weekStart = getWeekStart(merged);
    const weekKey = weekStart.toISOString().slice(0, 10);

    if (!weekMap[weekKey]) weekMap[weekKey] = {};
    weekMap[weekKey][pr.author_username] =
      (weekMap[weekKey][pr.author_username] || 0) + 1;
  }

  // Sort weeks chronologically
  const sortedWeeks = Object.keys(weekMap).sort();

  const series: TrendSeries[] = sortedWeeks.map((weekKey) => {
    const d = new Date(weekKey);
    const label = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const entry: TrendSeries = { week: label };
    for (const eng of topEngineers) {
      entry[eng.username] = weekMap[weekKey][eng.username] || 0;
    }
    return entry;
  });

  return {
    engineers: topEngineers.map((e) => ({
      username: e.username,
      name: e.name || e.username,
    })),
    series,
  };
}

export function getMethodology() {
  return {
    overview:
      'Impact measured across four dimensions with weighted scoring. Avoids vanity metrics like lines of code.',
    dimensions: [
      {
        name: 'Code Quality',
        weight: 0.3,
        description: 'Fast merge time, reasonable PR size, review activity',
        signals: [
          'Merge efficiency (lower time = higher quality)',
          'PR size optimization (200-500 lines sweet spot)',
          'Review engagement (understands quality standards)',
        ],
      },
      {
        name: 'Delivery Velocity',
        weight: 0.3,
        description: 'Consistent delivery of complex work',
        signals: [
          'PRs per month (consistency)',
          'Files changed per PR (complexity handling)',
        ],
      },
      {
        name: 'Collaboration',
        weight: 0.2,
        description: 'Helping teammates through code reviews',
        signals: [
          'Reviews given (volume)',
          'Comments per PR reviewed (depth)',
        ],
      },
      {
        name: 'Technical Leadership',
        weight: 0.2,
        description: 'Code ownership and balanced contributions',
        signals: [
          'Files touched (ownership breadth)',
          'Both authoring and reviewing (technical authority)',
        ],
      },
    ],
    philosophy:
      "This approach resists gaming. You can't just spam commits, make tiny PRs, or rubber-stamp reviews. Real impact requires quality code, consistent delivery, helpful reviews, and technical ownership.",
  };
}

// ── Utility ──────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
