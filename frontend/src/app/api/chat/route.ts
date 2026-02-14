import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { getGitHubData } from '@/lib/github';
import { analyzeEngineers, generateInsights, getDataDateRange } from '@/lib/analyzer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Get the same data the dashboard uses
  const data = await getGitHubData();
  const engineers = analyzeEngineers(data.contributors, data.prs);
  const insights = generateInsights(engineers, data.contributors);
  const dateRange = getDataDateRange(data.prs);

  // Build a rich context string from all dashboard data
  const context = JSON.stringify({
    repo: data.repo,
    dateRange,
    totalPRs: data.prs.length,
    totalContributors: engineers.length,
    engineers: engineers.map((e, i) => ({
      rank: i + 1,
      username: e.username,
      name: e.name,
      impact_score: e.impact_score,
      quality_score: e.quality_score,
      velocity_score: e.velocity_score,
      collaboration_score: e.collaboration_score,
      leadership_score: e.leadership_score,
      prs_created: e.stats.prs_created,
      reviews_given: e.stats.reviews_given,
      files_changed: e.stats.files_changed,
      avg_merge_time_hours: e.stats.avg_merge_time,
    })),
    insights: insights.map((ins) => ({
      label: ins.label,
      username: ins.username,
      name: ins.name,
      value: ins.value,
      description: ins.description,
    })),
  });

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: `You are an AI assistant embedded in an Engineering Impact Dashboard that analyzes the PostHog/posthog GitHub repository.

You have access to the full dashboard data below. Use it to answer ANY question the user asks about engineers, their performance, rankings, comparisons, trends, etc.

DASHBOARD DATA:
${context}

SCORING METHODOLOGY:
- Impact Score = 30% Code Quality + 30% Delivery Velocity + 20% Collaboration + 20% Technical Leadership
- Code Quality: merge speed, PR size optimization (200-500 lines sweet spot), review engagement
- Delivery Velocity: PR output consistency, complexity handling (files per PR)
- Collaboration: review volume, review depth (comments per PR reviewed)
- Technical Leadership: code ownership breadth, balanced authoring + reviewing
- All scores are population-relative (normalized against peers, not hardcoded thresholds)
- Engineers with fewer than 2 PRs are excluded

RULES:
- Always base your answers on the actual data provided above.
- When asked "who is the best", refer to the engineer with the highest impact_score (rank 1).
- Be specific with numbers and data points.
- Keep responses concise but informative.
- If comparing engineers, use a structured format.
- You can answer questions about any metric: PRs, reviews, merge time, scores, rankings, etc.
- If the user asks something not related to the dashboard data, politely redirect them.`,
    messages,
  });

  return result.toTextStreamResponse();
}
