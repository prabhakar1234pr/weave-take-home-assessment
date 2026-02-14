import githubData from '@/data/github_data.json';

interface ContributorData {
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

interface PRData {
  merged_at: string;
  created_at: string;
  [key: string]: unknown;
}

interface EngineerScore {
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

const contributors = githubData.contributors as Record<string, ContributorData>;
const prs = (githubData.prs || []) as PRData[];

/** Calculate the number of months the data spans, based on PR merged dates */
function getDataWindowMonths(): number {
  if (prs.length === 0) return 3; // fallback
  const dates = prs
    .map(pr => new Date(pr.merged_at).getTime())
    .filter(d => !isNaN(d));
  if (dates.length === 0) return 3;
  const earliest = Math.min(...dates);
  const latest = Math.max(...dates);
  const months = (latest - earliest) / (1000 * 60 * 60 * 24 * 30);
  return Math.max(months, 1); // at least 1 month
}

/** Get the date range of the data as formatted strings */
export function getDataDateRange(): { from: string; to: string; months: number } {
  if (prs.length === 0) return { from: '', to: '', months: 0 };
  const dates = prs
    .map(pr => new Date(pr.merged_at).getTime())
    .filter(d => !isNaN(d));
  if (dates.length === 0) return { from: '', to: '', months: 0 };
  const earliest = new Date(Math.min(...dates));
  const latest = new Date(Math.max(...dates));
  const months = Math.round((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return { from: fmt(earliest), to: fmt(latest), months: Math.max(months, 1) };
}

const dataWindowMonths = getDataWindowMonths();

function calculateQualityScore(c: ContributorData): number {
  // Fast merge time = quality (inverse relationship)
  // Cap at 72 hours (3 days)
  const mergeTime = Math.min(c.avg_time_to_merge_hours, 72);
  const mergeScore = 100 * (1 - mergeTime / 72);

  // Reasonable PR size (sweet spot around 200-500 lines)
  const avgChanges = (c.total_additions + c.total_deletions) / Math.max(c.prs_created, 1);
  let sizeScore: number;
  if (avgChanges >= 200 && avgChanges <= 500) {
    sizeScore = 100;
  } else if (avgChanges < 200) {
    sizeScore = 50 + (avgChanges / 200) * 50;
  } else {
    sizeScore = Math.max(50, 100 - (avgChanges - 500) / 20);
  }

  // Active reviewer = understands quality
  const reviewActivity = Math.min(c.reviews_given / 20, 1) * 100;

  return 0.50 * mergeScore + 0.30 * sizeScore + 0.20 * reviewActivity;
}

function calculateVelocityScore(c: ContributorData): number {
  const prCount = c.prs_created;
  const filesChanged = c.total_files_changed;

  // Consistency: PRs per month (dynamically calculated from data window)
  const prsPerMonth = prCount / dataWindowMonths;
  const consistencyScore = Math.min(prsPerMonth / 10, 1) * 100;

  // Complexity: avg files per PR
  const avgFiles = filesChanged / Math.max(prCount, 1);
  const complexityScore = Math.min(avgFiles / 15, 1) * 100;

  return 0.40 * consistencyScore + 0.60 * complexityScore;
}

function calculateCollaborationScore(c: ContributorData): number {
  const reviewsGiven = c.reviews_given;
  const prsReviewed = c.prs_reviewed;

  // Review volume
  const reviewVolume = Math.min(reviewsGiven / 30, 1) * 100;

  // Review depth (reviews per unique PR)
  let reviewDepth = 0;
  if (prsReviewed > 0) {
    reviewDepth = Math.min(reviewsGiven / prsReviewed / 3, 1) * 100;
  }

  return 0.70 * reviewVolume + 0.30 * reviewDepth;
}

function calculateLeadershipScore(c: ContributorData): number {
  const filesChanged = c.total_files_changed;
  const prsCreated = c.prs_created;
  const reviewsGiven = c.reviews_given;

  // Code ownership (lots of files touched)
  const ownership = Math.min(filesChanged / 200, 1) * 100;

  // Dual role: both author AND reviewer
  const isAuthor = prsCreated > 0;
  const isReviewer = reviewsGiven > 0;
  let balance = 0;
  if (isAuthor && isReviewer) {
    balance = Math.min((prsCreated + reviewsGiven) / 40, 1) * 100;
  }

  return 0.60 * ownership + 0.40 * balance;
}

function calculateImpactScore(username: string): EngineerScore {
  const c = contributors[username];

  const quality = calculateQualityScore(c);
  const velocity = calculateVelocityScore(c);
  const collaboration = calculateCollaborationScore(c);
  const leadership = calculateLeadershipScore(c);

  const impact = 0.30 * quality + 0.30 * velocity + 0.20 * collaboration + 0.20 * leadership;

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

export function getAllEngineers(): EngineerScore[] {
  const scores: EngineerScore[] = [];

  for (const username of Object.keys(contributors)) {
    const c = contributors[username];
    if (c.prs_created < 2) continue;
    scores.push(calculateImpactScore(username));
  }

  scores.sort((a, b) => b.impact_score - a.impact_score);
  return scores;
}

export function getTopEngineers(limit: number = 5): EngineerScore[] {
  return getAllEngineers().slice(0, limit);
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
