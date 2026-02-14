# PostHog Engineering Impact Dashboard

A single-page dashboard that identifies the most impactful engineers in the [PostHog/posthog](https://github.com/PostHog/posthog) repository using multi-dimensional scoring of GitHub activity.

Built with Next.js 16, deployed as a single instance on Vercel — no separate backend.

## How It Works

### Data Collection

A Python script (`github_fetcher.py`) pulls the last 90 days of merged PRs from the GitHub API and aggregates per-contributor stats:

| Raw Stat | What It Captures |
|---|---|
| `prs_created` | Number of merged PRs authored |
| `total_additions` / `total_deletions` | Lines added/removed across all PRs |
| `total_files_changed` | Files touched across all PRs |
| `avg_time_to_merge_hours` | Average time from PR open to merge |
| `reviews_given` | Total review comments left on others' PRs |
| `prs_reviewed` | Unique PRs reviewed |

This produces `github_data.json`, which ships with the app as static data.

### Scoring System

Each engineer is scored across **four dimensions**, then combined into an overall impact score.

#### Overall Impact Formula

```
Impact = 0.30 × Quality + 0.30 × Velocity + 0.20 × Collaboration + 0.20 × Leadership
```

All sub-scores are 0–100. Engineers with fewer than 2 PRs are excluded.

---

#### 1. Code Quality (30%)

```
Quality = 0.50 × MergeSpeed + 0.30 × PRSize + 0.20 × ReviewActivity
```

| Signal | Calculation | Reasoning |
|---|---|---|
| **Merge Speed** | `100 × (1 - min(hours, 72) / 72)` | Good code gets approved fast. Capped at 72h to ignore outliers. |
| **PR Size** | 100 if avg changes are 200–500 lines, scales down outside that range | Too small = trivial, too large = hard to review. 200–500 is the sweet spot. |
| **Review Activity** | `min(reviews / 20, 1) × 100` | Engineers who review others understand quality standards. |

#### 2. Delivery Velocity (30%)

```
Velocity = 0.40 × Consistency + 0.60 × Complexity
```

| Signal | Calculation | Reasoning |
|---|---|---|
| **Consistency** | `min(PRs_per_month / 10, 1) × 100` | Steady delivery > sporadic bursts. 10+ PRs/month = full marks. |
| **Complexity** | `min(avg_files_per_PR / 15, 1) × 100` | Touching many files per PR = handling complex, cross-cutting changes. |

#### 3. Collaboration (20%)

```
Collaboration = 0.70 × Volume + 0.30 × Depth
```

| Signal | Calculation | Reasoning |
|---|---|---|
| **Review Volume** | `min(reviews / 30, 1) × 100` | Helping the team by reviewing code. 30+ reviews = full marks. |
| **Review Depth** | `min(reviews / prs_reviewed / 3, 1) × 100` | Multiple comments per PR = substantive reviews, not rubber stamps. |

#### 4. Technical Leadership (20%)

```
Leadership = 0.60 × Ownership + 0.40 × Balance
```

| Signal | Calculation | Reasoning |
|---|---|---|
| **Code Ownership** | `min(files_changed / 200, 1) × 100` | Wide codebase knowledge. 200+ files = full marks. |
| **Balance** | `min((PRs + reviews) / 40, 1) × 100` (must do both) | Leaders both ship code and review it. Zero if only doing one. |

---

### Why This Resists Gaming

- **Can't spam tiny PRs** — velocity weights complexity (files per PR), not just count.
- **Can't make huge PRs** — quality penalizes PRs outside the 200–500 line sweet spot.
- **Can't rubber-stamp reviews** — collaboration measures depth (comments per PR), not just approvals.
- **Can't only write OR only review** — leadership requires both authoring and reviewing.

## Tech Stack

- **Next.js 16** — App Router, React 19, TypeScript
- **shadcn/ui** — Card, Badge, Avatar, Tabs, Table, Tooltip, ScrollArea, Skeleton, Alert, Button, Progress, Separator
- **Recharts** — Radar chart for score visualization
- **Tailwind CSS v4** — Styling
- **Vercel** — Deployment (single instance, no separate backend)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── all-engineers/route.ts    # GET all engineers ranked
│   │   ├── top-engineers/route.ts    # GET top N engineers
│   │   ├── methodology/route.ts      # GET scoring methodology
│   │   └── health/route.ts           # Health check
│   ├── layout.tsx
│   ├── page.tsx                      # Main dashboard
│   └── globals.css
├── components/
│   ├── Leaderboard.tsx               # Top 5 + scrollable rest
│   ├── ImpactChart.tsx               # Radar chart + score bars
│   ├── EngineersTable.tsx            # Full data table view
│   ├── Methodology.tsx               # Scoring explanation
│   ├── Loading.tsx                   # Skeleton loading state
│   ├── Providers.tsx                 # TooltipProvider wrapper
│   └── ui/                           # shadcn components
├── data/
│   └── github_data.json              # Pre-fetched GitHub data
├── lib/
│   ├── analyzer.ts                   # Scoring engine
│   ├── api.ts                        # API client
│   └── utils.ts                      # Utilities
└── types/
    └── engineer.ts                   # TypeScript interfaces
```

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables needed.

## Deployment

Push to GitHub and import into [Vercel](https://vercel.com). It auto-detects Next.js — zero configuration required.
