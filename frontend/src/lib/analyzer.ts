/**
 * Scoring engine — calculates multi-dimensional impact scores.
 * Uses population-relative normalization so scoring adapts to any data window.
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

export interface Insight {
  label: string;
  username: string;
  name: string;
  avatar_url: string;
  value: string;
  description: string;
}

// ── Population Stats ─────────────────────────────────────────────────

interface PopulationStats {
  maxPrs: number;
  maxReviewsGiven: number;
  maxFilesChanged: number;
  maxAvgFilesPerPr: number;
  maxCombined: number;
  p90MergeHours: number;
}

function computePopulationStats(
  contributors: Record<string, ContributorData>
): PopulationStats {
  const eligible = Object.values(contributors).filter(
    (c) => c.prs_created >= 2
  );

  if (eligible.length === 0) {
    return {
      maxPrs: 1,
      maxReviewsGiven: 1,
      maxFilesChanged: 1,
      maxAvgFilesPerPr: 1,
      maxCombined: 1,
      p90MergeHours: 72,
    };
  }

  const mergeTimes = eligible
    .filter((c) => c.avg_time_to_merge_hours > 0)
    .map((c) => c.avg_time_to_merge_hours)
    .sort((a, b) => a - b);
  const p90Idx = Math.floor(mergeTimes.length * 0.9);
  const p90MergeHours = mergeTimes[p90Idx] ?? 72;

  return {
    maxPrs: Math.max(...eligible.map((c) => c.prs_created)),
    maxReviewsGiven: Math.max(...eligible.map((c) => c.reviews_given), 1),
    maxFilesChanged: Math.max(...eligible.map((c) => c.total_files_changed), 1),
    maxAvgFilesPerPr: Math.max(
      ...eligible.map(
        (c) => c.total_files_changed / Math.max(c.prs_created, 1)
      ),
      1
    ),
    maxCombined: Math.max(
      ...eligible.map((c) => c.prs_created + c.reviews_given),
      1
    ),
    p90MergeHours,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

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

function calculateQualityScore(
  c: ContributorData,
  pop: PopulationStats
): number {
  // Merge speed: lower is better. Use P90 as ceiling for outlier robustness.
  const mergeTime = Math.min(c.avg_time_to_merge_hours, pop.p90MergeHours);
  const mergeScore = 100 * (1 - mergeTime / pop.p90MergeHours);

  // PR size sweet spot: 200-500 lines (industry standard, window-independent)
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

  // Review activity: normalize by population max
  const reviewActivity =
    Math.min(c.reviews_given / pop.maxReviewsGiven, 1) * 100;

  return 0.5 * mergeScore + 0.3 * sizeScore + 0.2 * reviewActivity;
}

function calculateVelocityScore(
  c: ContributorData,
  pop: PopulationStats
): number {
  // Consistency: PR count relative to population max
  const consistencyScore = Math.min(c.prs_created / pop.maxPrs, 1) * 100;

  // Complexity: avg files per PR relative to population max
  const avgFiles = c.total_files_changed / Math.max(c.prs_created, 1);
  const complexityScore =
    Math.min(avgFiles / pop.maxAvgFilesPerPr, 1) * 100;

  return 0.4 * consistencyScore + 0.6 * complexityScore;
}

function calculateCollaborationScore(
  c: ContributorData,
  pop: PopulationStats
): number {
  // Review volume: normalize by population max
  const reviewVolume =
    Math.min(c.reviews_given / pop.maxReviewsGiven, 1) * 100;

  // Review depth: ratio metric, no window dependency
  let reviewDepth = 0;
  if (c.prs_reviewed > 0) {
    reviewDepth = Math.min(c.reviews_given / c.prs_reviewed / 3, 1) * 100;
  }

  return 0.7 * reviewVolume + 0.3 * reviewDepth;
}

function calculateLeadershipScore(
  c: ContributorData,
  pop: PopulationStats
): number {
  // Code ownership: normalize by population max
  const ownership =
    Math.min(c.total_files_changed / pop.maxFilesChanged, 1) * 100;

  // Dual role: both author AND reviewer, normalize by population max
  let balance = 0;
  if (c.prs_created > 0 && c.reviews_given > 0) {
    balance =
      Math.min((c.prs_created + c.reviews_given) / pop.maxCombined, 1) * 100;
  }

  return 0.6 * ownership + 0.4 * balance;
}

function scoreContributor(
  username: string,
  c: ContributorData,
  pop: PopulationStats
): EngineerScore {
  const quality = calculateQualityScore(c, pop);
  const velocity = calculateVelocityScore(c, pop);
  const collaboration = calculateCollaborationScore(c, pop);
  const leadership = calculateLeadershipScore(c, pop);
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
  const pop = computePopulationStats(contributors);
  const scores: EngineerScore[] = [];

  for (const username of Object.keys(contributors)) {
    const c = contributors[username];
    if (c.prs_created < 2) continue;
    scores.push(scoreContributor(username, c, pop));
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

// ── Insights ─────────────────────────────────────────────────────────

export function generateInsights(
  engineers: EngineerScore[],
  contributors: Record<string, ContributorData>
): Insight[] {
  if (engineers.length === 0) return [];

  const insights: Insight[] = [];

  // Fastest Merger — lowest avg merge time among top half
  const withMerge = engineers.filter((e) => e.stats.avg_merge_time > 0);
  if (withMerge.length > 0) {
    const fastest = withMerge.reduce((a, b) =>
      a.stats.avg_merge_time < b.stats.avg_merge_time ? a : b
    );
    insights.push({
      label: 'Fastest Merger',
      username: fastest.username,
      name: fastest.name,
      avatar_url: fastest.avatar_url,
      value: `${fastest.stats.avg_merge_time.toFixed(1)}h avg`,
      description: 'Lowest average time from PR creation to merge',
    });
  }

  // Review Champion — most reviews given
  const reviewChamp = engineers.reduce((a, b) =>
    a.stats.reviews_given > b.stats.reviews_given ? a : b
  );
  insights.push({
    label: 'Review Champion',
    username: reviewChamp.username,
    name: reviewChamp.name,
    avatar_url: reviewChamp.avatar_url,
    value: `${reviewChamp.stats.reviews_given} reviews`,
    description: 'Most code reviews submitted across the team',
  });

  // Most Prolific — most PRs merged
  const prolific = engineers.reduce((a, b) =>
    a.stats.prs_created > b.stats.prs_created ? a : b
  );
  insights.push({
    label: 'Most Prolific',
    username: prolific.username,
    name: prolific.name,
    avatar_url: prolific.avatar_url,
    value: `${prolific.stats.prs_created} PRs`,
    description: 'Highest number of merged pull requests',
  });

  // Broadest Reach — most files changed
  const broadest = engineers.reduce((a, b) =>
    a.stats.files_changed > b.stats.files_changed ? a : b
  );
  insights.push({
    label: 'Broadest Reach',
    username: broadest.username,
    name: broadest.name,
    avatar_url: broadest.avatar_url,
    value: `${broadest.stats.files_changed} files`,
    description: 'Most files modified across the codebase',
  });

  // Most Well-Rounded — highest minimum dimension score
  const wellRounded = engineers.reduce((a, b) => {
    const minA = Math.min(
      a.quality_score,
      a.velocity_score,
      a.collaboration_score,
      a.leadership_score
    );
    const minB = Math.min(
      b.quality_score,
      b.velocity_score,
      b.collaboration_score,
      b.leadership_score
    );
    return minA > minB ? a : b;
  });
  const minScore = Math.min(
    wellRounded.quality_score,
    wellRounded.velocity_score,
    wellRounded.collaboration_score,
    wellRounded.leadership_score
  );
  insights.push({
    label: 'Most Well-Rounded',
    username: wellRounded.username,
    name: wellRounded.name,
    avatar_url: wellRounded.avatar_url,
    value: `${minScore.toFixed(0)}+ across all`,
    description: 'Highest minimum score across all four dimensions',
  });

  return insights;
}

// ── Trends ───────────────────────────────────────────────────────────

export function generateTrends(
  prs: PRData[],
  contributors: Record<string, ContributorData>,
  top: number = 5
): TrendResult {
  if (prs.length === 0) return { engineers: [], series: [] };

  const topEngineers = analyzeEngineers(contributors, prs).slice(0, top);
  const topUsernames = new Set(topEngineers.map((e) => e.username));

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
      'Impact measured across four dimensions with weighted scoring. Uses population-relative normalization — all thresholds adapt to the actual data.',
    dimensions: [
      {
        name: 'Code Quality',
        weight: 0.3,
        description: 'Fast merge time, reasonable PR size, review activity',
        signals: [
          'Merge efficiency (lower time = higher quality)',
          'PR size optimization (200-500 lines sweet spot)',
          'Review engagement relative to peers',
        ],
      },
      {
        name: 'Delivery Velocity',
        weight: 0.3,
        description: 'Consistent delivery of complex work',
        signals: [
          'PR output relative to peers (consistency)',
          'Files changed per PR (complexity handling)',
        ],
      },
      {
        name: 'Collaboration',
        weight: 0.2,
        description: 'Helping teammates through code reviews',
        signals: [
          'Reviews given relative to peers (volume)',
          'Comments per PR reviewed (depth)',
        ],
      },
      {
        name: 'Technical Leadership',
        weight: 0.2,
        description: 'Code ownership and balanced contributions',
        signals: [
          'Files touched relative to peers (ownership breadth)',
          'Both authoring and reviewing (technical authority)',
        ],
      },
    ],
    philosophy:
      "This approach resists gaming. You can't just spam commits, make tiny PRs, or rubber-stamp reviews. All metrics are normalized against the population, so scores reflect relative standing — not arbitrary thresholds.",
  };
}

// ── Utility ──────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
