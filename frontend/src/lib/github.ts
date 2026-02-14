/**
 * Hybrid data layer:
 *   1. BigQuery snapshot (github_data.json) — complete all-time base
 *   2. GitHub API overlay — fetches only PRs newer than the snapshot
 *   3. Merges both into a single unified dataset
 *
 * Background backfill via /api/cron/backfill fetches older PRs
 * (pre-2020) that GH Archive doesn't cover.
 */

// ── Types ────────────────────────────────────────────────────────────

interface RawPR {
  number: number;
  title: string;
  createdAt: string;
  mergedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  author: { login: string; avatarUrl: string } | null;
  reviews: {
    nodes: Array<{ author: { login: string; avatarUrl: string } | null }>;
  };
}

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

export interface PROutput {
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

export interface GitHubData {
  fetched_at: string;
  repo: string;
  contributors: Record<string, ContributorData>;
  prs: PROutput[];
}

// ── GraphQL Query ────────────────────────────────────────────────────

const GRAPHQL_URL = 'https://api.github.com/graphql';

const PR_QUERY = `
  query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(states: MERGED, first: 100, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          title
          createdAt
          mergedAt
          additions
          deletions
          changedFiles
          author { login avatarUrl }
          reviews(first: 100) {
            nodes {
              author { login avatarUrl }
            }
          }
        }
      }
    }
  }
`;

// ── Fetch helpers ────────────────────────────────────────────────────

function getRepoInfo() {
  let repo = process.env.GITHUB_REPO || 'PostHog/posthog';
  repo = repo.replace(/^https?:\/\/github\.com\//, '');
  const [owner, name] = repo.split('/');
  return { repo, owner, name };
}

async function fetchPage(
  token: string,
  owner: string,
  name: string,
  cursor: string | null,
  attempt = 1
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const MAX_RETRIES = 2;
  const body = JSON.stringify({
    query: PR_QUERY,
    variables: { owner, name, cursor },
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response: Response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${text}`);
    }

    const json = await response.json();
    if (json.errors) {
      throw new Error(`GraphQL error: ${json.errors[0].message}`);
    }
    return json;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      return fetchPage(token, owner, name, cursor, attempt + 1);
    }
    throw err;
  }
}

/**
 * Fetch only recent PRs — stops when it hits a PR already in the base dataset.
 * Returns newest-first.
 */
async function fetchRecentPRs(knownPrNumbers: Set<string>): Promise<RawPR[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];

  const { owner, name } = getRepoInfo();
  const recentPRs: RawPR[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let pages = 0;
  const MAX_PAGES = 10; // At most 1000 recent PRs — should be way more than enough

  while (hasNextPage && pages < MAX_PAGES) {
    try {
      const json = await fetchPage(token, owner, name, cursor);
      const prs = json.data.repository.pullRequests;
      let hitExisting = false;

      for (const pr of prs.nodes) {
        if (knownPrNumbers.has(String(pr.number))) {
          hitExisting = true;
          break;
        }
        recentPRs.push(pr);
      }

      if (hitExisting) break;

      hasNextPage = prs.pageInfo.hasNextPage;
      cursor = prs.pageInfo.endCursor;
      pages++;
    } catch (err) {
      console.warn(`[Hybrid] Overlay fetch stopped after ${recentPRs.length} new PRs:`, err);
      break;
    }
  }

  if (recentPRs.length > 0) {
    console.log(`[Hybrid] Fetched ${recentPRs.length} new PRs from GitHub API`);
  }
  return recentPRs;
}

/**
 * Fetch older PRs (for backfill) — paginate backward from the oldest known PR.
 * Used by the cron job to fill in pre-GH-Archive data.
 */
export async function fetchOlderPRs(maxPages: number = 50): Promise<RawPR[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];

  const { owner, name } = getRepoInfo();
  const olderPRs: RawPR[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let pages = 0;

  // Use ASC order to get oldest PRs first
  const OLD_PR_QUERY = `
    query($owner: String!, $name: String!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequests(states: MERGED, first: 100, after: $cursor, orderBy: {field: CREATED_AT, direction: ASC}) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            number title createdAt mergedAt additions deletions changedFiles
            author { login avatarUrl }
            reviews(first: 100) { nodes { author { login avatarUrl } } }
          }
        }
      }
    }
  `;

  while (hasNextPage && pages < maxPages) {
    try {
      const body = JSON.stringify({
        query: OLD_PR_QUERY,
        variables: { owner, name, cursor },
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response: Response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) break;

      const json = await response.json();
      if (json.errors) break;

      const prs = json.data.repository.pullRequests;
      olderPRs.push(...prs.nodes);
      hasNextPage = prs.pageInfo.hasNextPage;
      cursor = prs.pageInfo.endCursor;
      pages++;

      if (pages % 10 === 0) {
        console.log(`[Backfill] ${olderPRs.length} old PRs fetched (${pages} pages)...`);
      }

      // Stop if no more pages — we've reached the first commit
      if (!hasNextPage) {
        console.log(`[Backfill] Reached the very first PR — backfill complete.`);
      }
    } catch {
      break;
    }
  }

  console.log(`[Backfill] Complete: ${olderPRs.length} PRs across ${pages} pages`);
  return olderPRs;
}

// ── Aggregation ──────────────────────────────────────────────────────

function aggregateRawPRs(rawPRs: RawPR[]): {
  contributors: Record<string, ContributorData>;
  prs: PROutput[];
} {
  const cMap: Record<
    string,
    {
      name: string;
      avatar_url: string;
      prs_created: number;
      total_files_changed: number;
      total_additions: number;
      total_deletions: number;
      merge_hours: number[];
      reviews_given: number;
      prs_reviewed: Set<number>;
    }
  > = {};

  const prs: PROutput[] = [];

  for (const pr of rawPRs) {
    const author = pr.author;
    if (!author || author.login.endsWith('[bot]')) continue;

    const username = author.login;
    const created = new Date(pr.createdAt);
    const merged = new Date(pr.mergedAt);
    if (isNaN(created.getTime()) || isNaN(merged.getTime())) continue;
    const mergeHours = (merged.getTime() - created.getTime()) / (1000 * 3600);

    if (!cMap[username]) {
      cMap[username] = {
        name: username,
        avatar_url: author.avatarUrl,
        prs_created: 0,
        total_files_changed: 0,
        total_additions: 0,
        total_deletions: 0,
        merge_hours: [],
        reviews_given: 0,
        prs_reviewed: new Set(),
      };
    }

    const c = cMap[username];
    c.prs_created++;
    c.total_files_changed += pr.changedFiles;
    c.total_additions += pr.additions;
    c.total_deletions += pr.deletions;
    c.merge_hours.push(mergeHours);

    const reviewers: string[] = [];
    for (const review of pr.reviews.nodes) {
      if (!review.author || review.author.login.endsWith('[bot]')) continue;
      const rLogin = review.author.login;
      reviewers.push(rLogin);

      if (!cMap[rLogin]) {
        cMap[rLogin] = {
          name: rLogin,
          avatar_url: review.author.avatarUrl,
          prs_created: 0,
          total_files_changed: 0,
          total_additions: 0,
          total_deletions: 0,
          merge_hours: [],
          reviews_given: 0,
          prs_reviewed: new Set(),
        };
      }
      cMap[rLogin].reviews_given++;
      cMap[rLogin].prs_reviewed.add(pr.number);
    }

    prs.push({
      author_username: username,
      title: pr.title,
      files_changed: pr.changedFiles,
      additions: pr.additions,
      deletions: pr.deletions,
      time_to_merge_hours: Math.round(mergeHours * 100) / 100,
      created_at: pr.createdAt,
      merged_at: pr.mergedAt,
      reviews_count: pr.reviews.nodes.length,
      reviewers: [...new Set(reviewers)],
    });
  }

  const contributors: Record<string, ContributorData> = {};
  for (const [username, data] of Object.entries(cMap)) {
    const avgMerge =
      data.merge_hours.length > 0
        ? data.merge_hours.reduce((a, b) => a + b, 0) / data.merge_hours.length
        : 0;

    contributors[username] = {
      name: data.name,
      avatar_url: data.avatar_url,
      prs_created: data.prs_created,
      total_files_changed: data.total_files_changed,
      total_additions: data.total_additions,
      total_deletions: data.total_deletions,
      avg_time_to_merge_hours: Math.round(avgMerge * 100) / 100,
      reviews_given: data.reviews_given,
      prs_reviewed: data.prs_reviewed.size,
    };
  }

  return { contributors, prs };
}

/**
 * Merge overlay data (from GitHub API) into the base dataset (from BigQuery).
 * Adds new PRs and updates contributor stats.
 */
function mergeData(base: GitHubData, overlay: { contributors: Record<string, ContributorData>; prs: PROutput[] }): GitHubData {
  // Collect existing PR identifiers to avoid duplicates
  const existingPrs = new Set(
    base.prs.map((pr) => `${pr.author_username}:${pr.merged_at}`)
  );

  const newPrs = overlay.prs.filter(
    (pr) => !existingPrs.has(`${pr.author_username}:${pr.merged_at}`)
  );

  // Merge contributors: add overlay stats on top of base
  const merged: Record<string, ContributorData> = { ...base.contributors };
  for (const [username, overlayContrib] of Object.entries(overlay.contributors)) {
    if (!merged[username]) {
      merged[username] = overlayContrib;
    } else {
      const base = merged[username];
      const totalMergeHours =
        base.avg_time_to_merge_hours * base.prs_created +
        overlayContrib.avg_time_to_merge_hours * overlayContrib.prs_created;
      const totalPrs = base.prs_created + overlayContrib.prs_created;

      merged[username] = {
        name: overlayContrib.name || base.name,
        avatar_url: overlayContrib.avatar_url || base.avatar_url,
        prs_created: totalPrs,
        total_files_changed: base.total_files_changed + overlayContrib.total_files_changed,
        total_additions: base.total_additions + overlayContrib.total_additions,
        total_deletions: base.total_deletions + overlayContrib.total_deletions,
        avg_time_to_merge_hours: totalPrs > 0 ? Math.round((totalMergeHours / totalPrs) * 100) / 100 : 0,
        reviews_given: base.reviews_given + overlayContrib.reviews_given,
        prs_reviewed: base.prs_reviewed + overlayContrib.prs_reviewed,
      };
    }
  }

  // Combine PR lists, sort by merged_at descending
  const allPrs = [...newPrs, ...base.prs].sort(
    (a, b) => new Date(b.merged_at).getTime() - new Date(a.merged_at).getTime()
  );

  return {
    fetched_at: new Date().toISOString(),
    repo: base.repo,
    contributors: merged,
    prs: allPrs,
  };
}

// ── In-memory cache ──────────────────────────────────────────────────

let cachedData: GitHubData | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Backfill data stored in memory (survives across requests on same instance)
let backfillData: { contributors: Record<string, ContributorData>; prs: PROutput[] } | null = null;

/**
 * Called by the cron job to store backfilled older data.
 */
export function setBackfillData(data: { contributors: Record<string, ContributorData>; prs: PROutput[] }) {
  backfillData = data;
  // Invalidate cache so next request picks up the backfill
  cachedData = null;
  cacheTimestamp = 0;
}

export { aggregateRawPRs };

/**
 * Returns the full merged dataset:
 *   BigQuery base + GitHub API recent overlay + backfill overlay
 */
export async function getGitHubData(): Promise<GitHubData> {
  // Return in-memory cache if fresh
  if (cachedData && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedData;
  }

  // Load BigQuery base data
  const staticImport = await import('@/data/github_data.json');
  let baseData = staticImport.default as unknown as GitHubData;

  // If we have backfill data, merge it into the base
  if (backfillData) {
    baseData = mergeData(baseData, backfillData);
  }

  // Build a set of known PR numbers for the overlay fetch
  const knownPrNumbers = new Set<string>();
  for (const pr of baseData.prs) {
    // Extract PR number from title if available (e.g. "PR #12345")
    const match = pr.title?.match(/#(\d+)/);
    if (match) knownPrNumbers.add(match[1]);
  }
  // Also use merged_at dates — if we see a PR merged before our newest base PR, stop
  const newestBaseMerge = baseData.prs.length > 0 ? baseData.prs[0].merged_at : '';

  // Fetch recent PRs from GitHub API (fast — only a few pages)
  try {
    const recentRaw = await fetchRecentPRs(knownPrNumbers);
    if (recentRaw.length > 0) {
      const overlay = aggregateRawPRs(recentRaw);
      baseData = mergeData(baseData, overlay);
    }
  } catch (err) {
    console.warn('[Hybrid] Recent overlay fetch failed, using base only:', err);
  }

  cachedData = baseData;
  cacheTimestamp = Date.now();
  return cachedData;
}
