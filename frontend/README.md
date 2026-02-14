# Engineering Impact Dashboard

> A real-time dashboard that identifies the most impactful engineers in any GitHub repository using multi-dimensional, population-relative scoring.

Built for **Weave (YC W25)** — analyzing the [PostHog/posthog](https://github.com/PostHog/posthog) repository.

---

## Features

| Feature | Description |
|---|---|
| **Live KPI Cards** | 6 summary metrics (Contributors, PRs Merged, Reviews, Avg Impact, Avg Merge Time, Top Score) that update in real time |
| **Unique Insights** | 5 auto-generated insight cards — Fastest Merger, Review Champion, Most Prolific, Broadest Reach, Most Well-Rounded |
| **Leaderboard** | Top 5 highlighted + full ranked list of all contributors with radar charts |
| **All Engineers Table** | Sortable table view with per-engineer score breakdown |
| **Trend Analysis** | Weekly PR activity chart with time range presets (1W / 1M / 3M / 6M / 1Y / All) |
| **Compare View** | Side-by-side comparison of any two engineers |
| **Methodology** | Full transparency on how every score is calculated |
| **Real-Time Polling** | Auto-refreshes every 5 minutes with a live status indicator |
| **Static Fallback** | Works without a GitHub token using bundled snapshot data |

---

## Scoring System

Each engineer is scored across **four dimensions**, combined into a single 0–100 impact score.

### Composite Formula

```
Impact = 0.30 × Quality + 0.30 × Velocity + 0.20 × Collaboration + 0.20 × Leadership
```

Engineers with fewer than 2 merged PRs are excluded to avoid noise.

### Population-Relative Normalization

All thresholds are computed dynamically from the actual contributor population — not hardcoded. This means:

- Scores adapt automatically whether you're looking at 1 week or 5 years of data
- The top performer in each metric naturally scores ~100
- No arbitrary "10 PRs/month" or "200 files" ceilings

---

### 1. Code Quality (30%)

```
Quality = 0.50 × MergeSpeed + 0.30 × PRSize + 0.20 × ReviewActivity
```

| Signal | Formula | Why |
|---|---|---|
| **Merge Speed** | `100 × (1 − min(hours, P90) / P90)` | Fast merges indicate clean, well-described code. Capped at the 90th percentile to resist outlier distortion. |
| **PR Size** | 100 if avg lines ∈ [200, 500]; scales outside | Industry research shows 200–500 line PRs get the best reviews and have the lowest defect rate. |
| **Review Activity** | `min(reviews / max_in_population, 1) × 100` | Engineers who review others understand and enforce quality standards. |

### 2. Delivery Velocity (30%)

```
Velocity = 0.40 × Consistency + 0.60 × Complexity
```

| Signal | Formula | Why |
|---|---|---|
| **Consistency** | `min(PRs / max_PRs_in_pop, 1) × 100` | Steady delivery over time, normalized against the most active contributor. |
| **Complexity** | `min(avg_files_per_PR / max_avg_in_pop, 1) × 100` | Cross-cutting changes spanning multiple files indicate deeper system understanding. Weighted 60% to reward complexity over volume. |

### 3. Collaboration (20%)

```
Collaboration = 0.70 × Volume + 0.30 × Depth
```

| Signal | Formula | Why |
|---|---|---|
| **Review Volume** | `min(reviews / max_in_pop, 1) × 100` | Active participation in the team's code review process. |
| **Review Depth** | `min(reviews / PRs_reviewed / 3, 1) × 100` | Multiple review events per PR indicate substantive feedback, not rubber stamps. |

### 4. Technical Leadership (20%)

```
Leadership = 0.60 × Ownership + 0.40 × Balance
```

| Signal | Formula | Why |
|---|---|---|
| **Code Ownership** | `min(files / max_files_in_pop, 1) × 100` | Broad codebase familiarity — touching many areas signals system-wide influence. |
| **Balance** | `min((PRs + reviews) / max_combined_in_pop, 1) × 100` | Leaders both ship code and review it. Score is **0** if either PRs or reviews is zero. |

---

### Anti-Gaming Properties

| Attack Vector | Why It Fails |
|---|---|
| Spamming tiny PRs | Velocity weights complexity (files/PR), not just PR count |
| Inflating with huge PRs | Quality penalizes PRs outside the 200–500 line sweet spot |
| Rubber-stamping reviews | Collaboration measures depth (events per PR reviewed) |
| Only writing OR only reviewing | Leadership requires **both** — zero if either is missing |
| Manipulating absolute counts | Population-relative normalization means you're ranked against peers, not a fixed threshold |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) — App Router, React 19, TypeScript |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) — Card, Badge, Tabs, Table, Tooltip, Alert, Skeleton, etc. |
| **Charts** | [Recharts](https://recharts.org/) — Line charts for trends, radar charts for score breakdown |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Data Source** | GitHub GraphQL API (live) or static JSON snapshot (fallback) |
| **Deployment** | [Vercel](https://vercel.com/) — zero-config, single instance |

---

## Project Structure

```
frontend/src/
├── app/
│   ├── api/
│   │   ├── all-engineers/route.ts    # All engineers + KPIs + insights
│   │   ├── top-engineers/route.ts    # Top N engineers
│   │   ├── trends/route.ts          # Weekly trends with date filtering
│   │   ├── methodology/route.ts     # Scoring methodology
│   │   └── health/route.ts          # Health check
│   ├── page.tsx                     # Main dashboard (KPIs, insights, tabs)
│   ├── layout.tsx                   # Root layout
│   └── globals.css                  # Global styles
├── components/
│   ├── Leaderboard.tsx              # Top 5 + scrollable full list
│   ├── ImpactChart.tsx              # Radar chart + dimension bars
│   ├── EngineersTable.tsx           # Full sortable data table
│   ├── TrendChart.tsx               # Line chart with time range presets
│   ├── CompareView.tsx              # Side-by-side engineer comparison
│   ├── Methodology.tsx              # Detailed scoring explanation
│   ├── Loading.tsx                  # Skeleton loading state
│   ├── Providers.tsx                # Context providers
│   └── ui/                          # shadcn base components
├── data/
│   └── github_data.json             # Static fallback data snapshot
├── lib/
│   ├── analyzer.ts                  # Scoring engine + insights generator
│   ├── github.ts                    # GitHub GraphQL fetcher + cache
│   ├── api.ts                       # Client-side API helpers
│   └── utils.ts                     # Utility functions
└── types/
    └── engineer.ts                  # TypeScript interfaces
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**

### Installation

```bash
cd frontend
npm install
```

### Running Locally

**Without a GitHub token** (uses bundled static data):

```bash
npm run dev
```

**With real-time GitHub data:**

```bash
cp .env.example .env
# Edit .env and add your GitHub Personal Access Token
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | No | — | GitHub Personal Access Token. Without it, the dashboard uses static snapshot data. Create one at [github.com/settings/tokens](https://github.com/settings/tokens) with `public_repo` scope. |
| `GITHUB_REPO` | No | `PostHog/posthog` | The `owner/repo` to analyze. |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (React 19)                                 │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ KPI Cards│  │ Insights │  │ Leaderboard/Table │ │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘ │
│       │              │                 │            │
│       └──────────────┼─────────────────┘            │
│                      │                              │
│              polls every 5 min                      │
│                      │                              │
│               /api/all-engineers                    │
└──────────────────────┼──────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────┐
│  Next.js API Routes (Server)                        │
│                      │                              │
│  ┌───────────────────┴────────────────────────────┐ │
│  │  getGitHubData()                               │ │
│  │  ├─ Cache hit (< 5 min)? → return cached       │ │
│  │  ├─ GITHUB_TOKEN set? → fetch via GraphQL      │ │
│  │  └─ No token? → import github_data.json        │ │
│  └────────────────────────────────────────────────┘ │
│                      │                              │
│  ┌───────────────────┴────────────────────────────┐ │
│  │  analyzeEngineers() + generateInsights()       │ │
│  │  Population-relative scoring engine            │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import the repository in [Vercel](https://vercel.com/)
3. Set the **Root Directory** to `frontend`
4. Add `GITHUB_TOKEN` as an environment variable (optional)
5. Deploy — Vercel auto-detects Next.js

### Production Build

```bash
cd frontend
npm run build
npm start
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/all-engineers` | GET | All engineers with scores, date range, insights, and total PR count |
| `/api/top-engineers?limit=5` | GET | Top N engineers by impact score |
| `/api/trends?top=5&from=ISO&to=ISO` | GET | Weekly PR trends, filterable by date range |
| `/api/methodology` | GET | Scoring methodology description |
| `/api/health` | GET | Health check |

---

## License

Built for the Weave (YC W25) take-home assessment.
