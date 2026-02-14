import { getGitHubData } from '@/lib/github';
import { analyzeEngineers, generateInsights, getDataDateRange } from '@/lib/analyzer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_GENERATIVE_AI_API_KEY not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get the same data the dashboard uses
  const data = await getGitHubData();
  const engineers = analyzeEngineers(data.contributors, data.prs);
  const insights = generateInsights(engineers, data.contributors);
  const dateRange = getDataDateRange(data.prs);

  const context = JSON.stringify({
    repo: data.repo,
    dateRange,
    totalPRs: data.prs.length,
    totalContributors: engineers.length,
    engineers: engineers.slice(0, 50).map((e, i) => ({
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

  const systemPrompt = `You are an AI assistant embedded in an Engineering Impact Dashboard that analyzes the PostHog/posthog GitHub repository.

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
- If the user asks something not related to the dashboard data, politely redirect them.`;

  // Build Gemini API request
  const geminiMessages = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I have access to the full Engineering Impact Dashboard data. How can I help you?' }] },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ];

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    console.error('[Chat] Gemini API error:', geminiRes.status, errText);
    if (geminiRes.status === 429) {
      return new Response('Rate limit reached. Please wait a minute and try again.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    return new Response('AI service is temporarily unavailable. Please try again later.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Stream the SSE response as plain text
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            } catch {
              // skip malformed JSON chunks
            }
          }
        }
      } catch (err) {
        console.error('[Chat] Stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
