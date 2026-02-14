# Engineering Impact Dashboard

> A real-time, interactive dashboard that identifies the most impactful engineers in the [PostHog/posthog](https://github.com/PostHog/posthog) GitHub repository using multi-dimensional, population-relative scoring.

Built for **[Weave (YC W25)](https://workweave.ai)** take-home assessment.

**Live Demo:** [weave-take-home-assessment.vercel.app](https://weave-take-home-assessment.vercel.app)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Scoring Methodology](#scoring-methodology)
- [Data Pipeline](#data-pipeline)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

PostHog is a popular open-source analytics platform with 425+ contributors and 38,000+ merged PRs. This dashboard analyzes that activity to answer: **who are the most impactful engineers?**

Impact is measured across four dimensions — Code Quality, Delivery Velocity, Collaboration, and Technical Leadership — each scored 0–100 and combined into a single weighted composite. All thresholds are computed dynamically from the actual contributor population, not hardcoded, so scores adapt whether you're looking at 1 week or 6 years of data.

The target audience is a busy engineering leader who needs a clear, at-a-glance view of engineer contributions without reading every PR.

---

## Features

| Feature | Description |
|---|---|
| **Live KPI Cards** | 6 summary metrics (Contributors, PRs Merged, Reviews, Avg Impact, Avg Merge Time, Top Score) updating in real time |
| **Key Insights** | Auto-generated cards — Fastest Merger, Review Champion, Most Prolific, Broadest Reach, Most Well-Rounded |
| **Leaderboard** | Top 5 engineers highlighted with gradient rank badges, plus full ranked list with radar charts |
| **All Engineers Table** | Sortable table with per-engineer score breakdowns across all four dimensions |
| **Trend Analysis** | Weekly PR activity area chart with presets (1W / 1M / 3M / 6M / 1Y / All) and a custom date range picker |
| **Compare View** | Side-by-side comparison of any two engineers with radar overlay and bar charts |
| **Methodology** | Full transparency on how every score is calculated — formulas, weights, and anti-gaming properties |
| **AI Chatbot** | Groq-powered assistant that can answer questions about the data (e.g., "Who is the best engineer?") |
| **Real-Time Polling** | Auto-refreshes every 5 minutes with a live status indicator |
| **Background Backfill** | Vercel Cron job progressively fetches older PRs (pre-2020) and persists to Vercel Blob storage |
| **Static Fallback** | Works without a GitHub token using a bundled BigQuery snapshot (~23K PRs) |

---

## Scoring Methodology

Each engineer is scored across **four independent dimensions**, combined into a single 0–100 impact score.

### Composite Formula

```
Impact = 0.30 × Quality + 0.30 × Velocity + 0.20 × Collaboration + 0.20 × Leadership
```

Engineers with fewer than 2 merged PRs are excluded to reduce noise.

### Population-Relative Normalization

All thresholds are computed dynamically from the actual contributor population:

- Scores adapt automatically to any time window (1 week to all-time)
- The top performer in each metric naturally scores ~100
- No arbitrary hardcoded ceilings

### Dimension Breakdown

#### 1. Code Quality (30%)

```
Quality = 0.50 × MergeSpeed + 0.30 × PRSize + 0.20 × ReviewActivity
```

| Signal | Formula | Rationale |
|---|---|---|
| **Merge Speed** | `100 × (1 − min(hours, P90) / P90)` | Fast merges indicate clean, well-described code. Capped at P90 to resist outliers. |
| **PR Size** | 100 if avg lines ∈ [200, 500]; scales outside | Research shows 200–500 line PRs get the best reviews and lowest defect rate. |
| **Review Activity** | `min(reviews / max_in_population, 1) × 100` | Engineers who review others enforce quality standards. |

#### 2. Delivery Velocity (30%)

```
Velocity = 0.40 × Consistency + 0.60 × Complexity
```

| Signal | Formula | Rationale |
|---|---|---|
| **Consistency** | `min(PRs / max_PRs_in_pop, 1) × 100` | Steady delivery normalized against the most active contributor. |
| **Complexity** | `min(avg_files_per_PR / max_avg_in_pop, 1) × 100` | Cross-cutting changes spanning multiple files indicate deeper system understanding. |

#### 3. Collaboration (20%)

```
Collaboration = 0.70 × Volume + 0.30 × Depth
```

| Signal | Formula | Rationale |
|---|---|---|
| **Review Volume** | `min(reviews / max_in_pop, 1) × 100` | Active participation in code review. |
| **Review Depth** | `min(reviews / PRs_reviewed / 3, 1) × 100` | Multiple review events per PR indicate substantive feedback, not rubber stamps. |

#### 4. Technical Leadership (20%)

```
Leadership = 0.60 × Ownership + 0.40 × Balance
```

| Signal | Formula | Rationale |
|---|---|---|
| **Code Ownership** | `min(files / max_files_in_pop, 1) × 100` | Broad codebase familiarity signals system-wide influence. |
| **Balance** | `min((PRs + reviews) / max_combined_in_pop, 1) × 100` | Leaders both ship code and review it. Score is 0 if either is missing. |

### Anti-Gaming Properties

| Attack Vector | Why It Fails |
|---|---|
| Spamming tiny PRs | Velocity weights complexity (files/PR), not just count |
| Inflating with huge PRs | Quality penalizes PRs outside the 200–500 line sweet spot |
| Rubber-stamping reviews | Collaboration measures depth (events per PR reviewed) |
| Only writing OR only reviewing | Leadership requires both — zero if either is missing |
| Manipulating absolute counts | Population-relative normalization ranks against peers, not fixed thresholds |

---

## Data Pipeline

The dashboard uses a **three-layer hybrid data pipeline**:

```
┌──────────────────────────────────────────────────────────────────┐
│  Layer 1: BigQuery Snapshot (base)                               │
│  ─────────────────────────────                                   │
│  ~23K merged PRs from GH Archive (2020 – snapshot date)         │
│  Bundled as github_data.json — loads instantly, no API calls     │
├──────────────────────────────────────────────────────────────────┤
│  Layer 2: GitHub API Overlay (real-time)                         │
│  ──────────────────────────────────                              │
│  On each request, fetches only PRs newer than the snapshot       │
│  via GitHub GraphQL API — typically 1-3 pages, sub-second        │
├──────────────────────────────────────────────────────────────────┤
│  Layer 3: Vercel Cron Backfill (background)                      │
│  ────────────────────────────────────────                        │
│  Every 6 hours, fetches older PRs (pre-2020) from GitHub API     │
│  Persists to Vercel Blob storage — survives across cold starts   │
│  Automatically stops once it reaches the first commit            │
└──────────────────────────────────────────────────────────────────┘
```

All three layers are merged and deduplicated at query time, producing a single unified dataset.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) — App Router, React 19, TypeScript |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| **Charts** | [Recharts](https://recharts.org/) — area charts, radar charts, bar charts |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **AI Chatbot** | [Groq](https://console.groq.com/) (llama-3.3-70b-versatile) — streaming via SSE |
| **Data Sources** | GitHub GraphQL API (live) + Google BigQuery / GH Archive (historical) |
| **Persistent Storage** | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) — backfill data |
| **Scheduling** | [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) — every 6 hours |
| **Deployment** | [Vercel](https://vercel.com/) |

---

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── all-engineers/route.ts    # All engineers + KPIs + insights
│   │   │   ├── top-engineers/route.ts    # Top N engineers by impact score
│   │   │   ├── trends/route.ts           # Weekly trends with date filtering
│   │   │   ├── chat/route.ts             # AI chatbot (Gemini streaming)
│   │   │   ├── cron/backfill/route.ts    # Background PR backfill cron job
│   │   │   ├── methodology/route.ts      # Scoring methodology
│   │   │   └── health/route.ts           # Health check
│   │   ├── page.tsx                      # Main dashboard (KPIs, insights, tabs)
│   │   ├── layout.tsx                    # Root layout + metadata
│   │   └── globals.css                   # Global styles + CSS variables
│   ├── components/
│   │   ├── ChatBot.tsx                   # Floating AI chatbot panel
│   │   ├── Leaderboard.tsx               # Top 5 + full ranked list
│   │   ├── ImpactChart.tsx               # Radar chart + dimension bars
│   │   ├── EngineersTable.tsx            # Sortable data table
│   │   ├── TrendChart.tsx                # Area chart + custom date picker
│   │   ├── CompareView.tsx               # Side-by-side comparison
│   │   ├── Methodology.tsx               # Scoring explanation
│   │   ├── Loading.tsx                   # Skeleton loading state
│   │   ├── Providers.tsx                 # Context providers
│   │   └── ui/                           # shadcn base components
│   ├── data/
│   │   └── github_data.json              # BigQuery snapshot (~23K PRs)
│   ├── lib/
│   │   ├── analyzer.ts                   # Scoring engine + insights + trends
│   │   ├── github.ts                     # Hybrid data layer + Blob persistence
│   │   ├── api.ts                        # Client-side API helpers
│   │   └── utils.ts                      # Utility functions
│   └── types/
│       └── engineer.ts                   # TypeScript interfaces
├── vercel.json                           # Cron job configuration
├── package.json
└── .env.example
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **npm**, **yarn**, or **pnpm**

### Installation

```bash
cd frontend
npm install
```

### Running Locally

**Without a GitHub token** (uses bundled BigQuery snapshot):

```bash
npm run dev
```

**With real-time GitHub data:**

```bash
cp .env.example .env
# Edit .env and add your tokens (see Environment Variables below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | No | — | GitHub Personal Access Token with `public_repo` scope. Without it, the dashboard uses the static BigQuery snapshot. [Create one here](https://github.com/settings/tokens). |
| `GITHUB_REPO` | No | `PostHog/posthog` | The `owner/repo` to analyze. |
| `GROQ_API_KEY` | No | — | Groq API key for the AI chatbot. [Get one here](https://console.groq.com/keys). Without it, the chatbot will show an error. |
| `CRON_SECRET` | No | — | Bearer token for authenticating Vercel Cron invocations in production. |
| `BLOB_READ_WRITE_TOKEN` | No | — | Auto-injected by Vercel when a Blob store is connected to the project. Required for backfill persistence. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React 19 + Next.js App Router)                        │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌─────────────────┐  │
│  │ KPI Cards│ │ Insights │ │ Leaderboard│ │ AI Chatbot      │  │
│  └────┬─────┘ └────┬─────┘ └─────┬──────┘ └───────┬─────────┘  │
│       └─────────────┼────────────┘                 │            │
│                     │ polls every 5 min            │            │
│              /api/all-engineers              /api/chat          │
└─────────────────────┼──────────────────────────────┼────────────┘
                      │                              │
┌─────────────────────┼──────────────────────────────┼────────────┐
│  Next.js API Routes │                              │            │
│                     ▼                              ▼            │
│  ┌────────────────────────────┐   ┌──────────────────────────┐  │
│  │  getGitHubData()           │   │  Google Gemini 2.0 Flash │  │
│  │  ├─ Cache hit? → return    │   │  Streaming SSE response  │  │
│  │  ├─ Load BigQuery base     │   └──────────────────────────┘  │
│  │  ├─ Load backfill (Blob)   │                                 │
│  │  ├─ Fetch recent (API)     │                                 │
│  │  └─ Merge + deduplicate    │                                 │
│  └────────────────────────────┘                                 │
│                     │                                           │
│  ┌────────────────────────────┐   ┌──────────────────────────┐  │
│  │  analyzeEngineers()        │   │  /api/cron/backfill      │  │
│  │  generateInsights()        │   │  Every 6h via Vercel Cron│  │
│  │  generateTrends()          │   │  Persists to Vercel Blob │  │
│  └────────────────────────────┘   └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Hybrid data layer** — BigQuery provides the historical base instantly; the GitHub API adds only the delta. This avoids paginating through 385+ pages on every request.

2. **Population-relative scoring** — No hardcoded thresholds. Scores are computed relative to the actual population, so they work across any time window or repository size.

3. **Vercel Blob for backfill persistence** — Serverless functions are stateless, so the cron job persists backfilled data to Vercel Blob. Dashboard API routes load it on cold start.

4. **Streaming AI responses** — The chatbot streams Groq responses via Server-Sent Events for a responsive conversational experience.

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/all-engineers` | GET | All engineers with scores, date range, insights, KPIs, and total PR count |
| `/api/top-engineers?limit=5` | GET | Top N engineers by impact score |
| `/api/trends?top=5&from=ISO&to=ISO` | GET | Weekly PR activity trends, filterable by date range and top N |
| `/api/chat` | POST | AI chatbot — accepts `{ messages }`, streams Gemini response |
| `/api/cron/backfill?pages=50` | GET | Background backfill of older PRs (called by Vercel Cron every 6h) |
| `/api/methodology` | GET | Scoring methodology description |
| `/api/health` | GET | Health check |

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import the repository in [Vercel](https://vercel.com/)
3. Set the **Root Directory** to `frontend`
4. Add environment variables: `GITHUB_TOKEN`, `GROQ_API_KEY` (optional: `CRON_SECRET`)
5. Create a **Blob Store** under Storage and connect it to the project (for backfill persistence)
6. Deploy — Vercel auto-detects Next.js and schedules the cron job

### Local Production Build

```bash
cd frontend
npm run build
npm start
```

---

## License

Built for the [Weave (YC W25)](https://workweave.ai) take-home assessment.
