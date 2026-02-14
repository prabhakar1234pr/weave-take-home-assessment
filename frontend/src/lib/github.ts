/**
 * Server-side GitHub data fetcher using GraphQL API.
 * Fetches ALL merged PRs (not limited to 90 days) with full details.
 * Includes in-memory caching for warm lambda reuse.
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

// ── Fetch from GitHub ────────────────────────────────────────────────

async function fetchMergedPRs(): Promise<RawPR[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  const repo = process.env.GITHUB_REPO || 'PostHog/posthog';
  const [owner, name] = repo.split('/');

  const allPRs: RawPR[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let pages = 0;
  const MAX_PAGES = 50; // up to 5000 PRs

  while (hasNextPage && pages < MAX_PAGES) {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: PR_QUERY,
        variables: { owner, name, cursor },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${text}`);
    }

    const json = await response.json();

    if (json.errors) {
      throw new Error(`GraphQL error: ${json.errors[0].message}`);
    }

    const prs = json.data.repository.pullRequests;
    allPRs.push(...prs.nodes);
    hasNextPage = prs.pageInfo.hasNextPage;
    cursor = prs.pageInfo.endCursor;
    pages++;
  }

  return allPRs;
}

// ── Aggregate into contributor + PR data ─────────────────────────────

function aggregateData(rawPRs: RawPR[]): GitHubData {
  const repo = process.env.GITHUB_REPO || 'PostHog/posthog';

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

    // Process reviews
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

  // Convert to final format
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

  return {
    fetched_at: new Date().toISOString(),
    repo,
    contributors,
    prs,
  };
}

// ── In-memory cache ──────────────────────────────────────────────────

let cachedData: GitHubData | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Returns GitHub data. Fetches from API if GITHUB_TOKEN is set,
 * otherwise falls back to the static JSON snapshot.
 */
export async function getGitHubData(): Promise<GitHubData> {
  // Return in-memory cache if fresh
  if (cachedData && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedData;
  }

  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    // No token — fall back to static JSON
    const staticData = await import('@/data/github_data.json');
    return staticData.default as unknown as GitHubData;
  }

  try {
    const rawPRs = await fetchMergedPRs();
    cachedData = aggregateData(rawPRs);
    cacheTimestamp = Date.now();
    return cachedData;
  } catch (error) {
    // If fetch fails but we have stale cache, use it
    if (cachedData) return cachedData;
    // Last resort: static JSON
    console.error('GitHub fetch failed, using static fallback:', error);
    const staticData = await import('@/data/github_data.json');
    return staticData.default as unknown as GitHubData;
  }
}
