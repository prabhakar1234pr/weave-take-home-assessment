/**
 * Fetches all PostHog/posthog merged PR data from GH Archive via BigQuery,
 * then writes it into the github_data.json format the dashboard expects.
 *
 * Usage: node scripts/fetch-bigquery.js
 * Requires: gcloud CLI authenticated with a project that has BigQuery access.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = 'PostHog/posthog';
const OUTPUT = path.join(__dirname, '..', 'src', 'data', 'github_data.json');

function bqQuery(sql) {
  // Write SQL to a temp file to avoid shell escaping issues with backticks
  const tmpFile = path.join(os.tmpdir(), `bq_query_${Date.now()}.sql`);
  fs.writeFileSync(tmpFile, sql);
  console.log('  Running BigQuery query...');
  try {
    const cmd = `Get-Content "${tmpFile}" -Raw | bq query --use_legacy_sql=false --format=json --max_rows=100000`;
    const result = execSync(`powershell -Command "${cmd}"`, {
      maxBuffer: 200 * 1024 * 1024,
      encoding: 'utf-8',
    });
    // bq outputs status lines then JSON — find the JSON array
    const jsonStart = result.indexOf('[');
    if (jsonStart === -1) {
      throw new Error('No JSON array found in BigQuery output');
    }
    return JSON.parse(result.slice(jsonStart));
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function main() {
  console.log(`Fetching all merged PR data for ${REPO} from GH Archive...`);
  console.log('');

  // ── Step 1: Fetch all merged PRs ──────────────────────────────
  console.log('[1/3] Querying merged PRs (this may take 2-3 minutes)...');
  const prRows = bqQuery(`
    SELECT
      JSON_VALUE(payload, '$.pull_request.user.login') AS author,
      JSON_VALUE(payload, '$.pull_request.number') AS pr_number,
      CAST(JSON_VALUE(payload, '$.pull_request.additions') AS INT64) AS additions,
      CAST(JSON_VALUE(payload, '$.pull_request.deletions') AS INT64) AS deletions,
      CAST(JSON_VALUE(payload, '$.pull_request.changed_files') AS INT64) AS changed_files,
      JSON_VALUE(payload, '$.pull_request.created_at') AS created_at,
      JSON_VALUE(payload, '$.pull_request.merged_at') AS merged_at,
      JSON_VALUE(payload, '$.pull_request.user.avatar_url') AS avatar_url
    FROM \`githubarchive.day.20*\`
    WHERE repo.name = '${REPO}'
      AND type = 'PullRequestEvent'
      AND JSON_VALUE(payload, '$.action') = 'closed'
      AND JSON_VALUE(payload, '$.pull_request.merged') = 'true'
  `);
  console.log(`  Found ${prRows.length} merged PRs`);

  // ── Step 2: Fetch all review events ───────────────────────────
  console.log('[2/3] Querying review events (this may take 2-3 minutes)...');
  const reviewRows = bqQuery(`
    SELECT
      actor.login AS reviewer,
      JSON_VALUE(payload, '$.pull_request.number') AS pr_number,
      actor.avatar_url AS avatar_url
    FROM \`githubarchive.day.20*\`
    WHERE repo.name = '${REPO}'
      AND type = 'PullRequestReviewEvent'
  `);
  console.log(`  Found ${reviewRows.length} review events`);

  // ── Step 3: Aggregate ─────────────────────────────────────────
  console.log('[3/3] Aggregating data...');

  // Deduplicate PRs by pr_number (GH Archive can have duplicates)
  const prMap = new Map();
  for (const row of prRows) {
    const num = row.pr_number;
    if (!prMap.has(num)) {
      prMap.set(num, row);
    }
  }
  const uniquePRs = Array.from(prMap.values());
  console.log(`  Unique PRs after dedup: ${uniquePRs.length}`);

  // Build review index: pr_number -> [reviewers]
  const reviewIndex = {};
  for (const row of reviewRows) {
    const num = row.pr_number;
    if (!reviewIndex[num]) reviewIndex[num] = [];
    reviewIndex[num].push(row.reviewer);
  }

  // Build contributor map
  const cMap = {};
  const prs = [];

  for (const pr of uniquePRs) {
    const author = pr.author;
    if (!author || author.endsWith('[bot]')) continue;

    const created = new Date(pr.created_at);
    const merged = new Date(pr.merged_at);
    if (isNaN(created.getTime()) || isNaN(merged.getTime())) continue;

    const mergeHours = (merged.getTime() - created.getTime()) / (1000 * 3600);
    const additions = parseInt(pr.additions) || 0;
    const deletions = parseInt(pr.deletions) || 0;
    const changedFiles = parseInt(pr.changed_files) || 0;

    if (!cMap[author]) {
      cMap[author] = {
        name: author,
        avatar_url: pr.avatar_url || `https://avatars.githubusercontent.com/${author}`,
        prs_created: 0,
        total_files_changed: 0,
        total_additions: 0,
        total_deletions: 0,
        merge_hours: [],
        reviews_given: 0,
        prs_reviewed: new Set(),
      };
    }

    const c = cMap[author];
    c.prs_created++;
    c.total_files_changed += changedFiles;
    c.total_additions += additions;
    c.total_deletions += deletions;
    c.merge_hours.push(mergeHours);

    // Process reviews for this PR
    const reviewers = reviewIndex[pr.pr_number] || [];
    const uniqueReviewers = [...new Set(reviewers)];
    for (const reviewer of uniqueReviewers) {
      if (reviewer.endsWith('[bot]')) continue;
      if (!cMap[reviewer]) {
        cMap[reviewer] = {
          name: reviewer,
          avatar_url: `https://avatars.githubusercontent.com/${reviewer}`,
          prs_created: 0,
          total_files_changed: 0,
          total_additions: 0,
          total_deletions: 0,
          merge_hours: [],
          reviews_given: 0,
          prs_reviewed: new Set(),
        };
      }
      cMap[reviewer].reviews_given++;
      cMap[reviewer].prs_reviewed.add(pr.pr_number);
    }

    prs.push({
      author_username: author,
      title: `PR #${pr.pr_number}`,
      files_changed: changedFiles,
      additions,
      deletions,
      time_to_merge_hours: Math.round(mergeHours * 100) / 100,
      created_at: pr.created_at,
      merged_at: pr.merged_at,
      reviews_count: uniqueReviewers.length,
      reviewers: uniqueReviewers,
    });
  }

  // Convert to final format
  const contributors = {};
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

  const output = {
    fetched_at: new Date().toISOString(),
    repo: REPO,
    source: 'bigquery-gharchive',
    contributors,
    prs,
  };

  // Sort PRs by merged_at descending
  output.prs.sort((a, b) => new Date(b.merged_at) - new Date(a.merged_at));

  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));

  const contributorCount = Object.keys(contributors).length;
  const prCount = prs.length;
  const fileSize = (fs.statSync(OUTPUT).size / (1024 * 1024)).toFixed(1);

  console.log('');
  console.log('Done!');
  console.log(`  Contributors: ${contributorCount}`);
  console.log(`  PRs: ${prCount}`);
  console.log(`  Output: ${OUTPUT} (${fileSize} MB)`);
}

main();
