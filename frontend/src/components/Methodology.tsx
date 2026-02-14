'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  ShieldAlert,
  GitPullRequest,
  Clock,
  FileCode,
  MessageSquare,
  Users,
  Crown,
  Scale,
  Database,
  ArrowRight,
  Calculator,
  BarChart3,
  Info,
} from 'lucide-react';

const dimensions = [
  {
    name: 'Code Quality',
    weight: 30,
    color: '#3b82f6',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    badgeClass: 'bg-blue-500 text-white',
    icon: FileCode,
    rationale:
      'Code quality captures how well an engineer writes code that is easy to review, appropriately scoped, and meets team standards. High-quality contributors produce work that moves through the review process efficiently.',
    formula: 'Quality = 0.50 × Merge Speed + 0.30 × PR Size + 0.20 × Review Activity',
    signals: [
      {
        name: 'Merge Speed (50%)',
        calc: '100 × (1 − min(avg_merge_hours, P90) / P90)',
        explanation:
          'Measures the average time between PR creation and merge. The score is inversely proportional to merge time, capped at the 90th percentile (P90) of the population to prevent extreme outliers from compressing scores. An engineer whose PRs merge quickly scores near 100; those near the P90 ceiling score near 0.',
        icon: Clock,
      },
      {
        name: 'PR Size (30%)',
        calc: '100 if avg lines ∈ [200, 500]; scales linearly outside that range',
        explanation:
          'Evaluates the average number of lines changed (additions + deletions) per PR. Research consistently shows that PRs in the 200–500 line range receive the most thorough reviews and have the lowest defect rate. PRs below 200 lines receive partial credit (minimum 50), as they may indicate trivial changes. PRs above 500 lines are penalized progressively, floored at 50, reflecting the diminishing review quality on large changesets.',
        icon: FileCode,
      },
      {
        name: 'Review Activity (20%)',
        calc: 'min(reviews_given / max_reviews_in_population, 1) × 100',
        explanation:
          'Engineers who actively review others\u2019 code demonstrate an understanding of quality standards and contribute to the team\u2019s overall code health. This metric normalizes review count against the population maximum, so the most active reviewer scores 100 and others are proportionally distributed.',
        icon: MessageSquare,
      },
    ],
  },
  {
    name: 'Delivery Velocity',
    weight: 30,
    color: '#10b981',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    badgeClass: 'bg-emerald-500 text-white',
    icon: BarChart3,
    rationale:
      'Delivery velocity measures how much meaningful work an engineer ships over the analysis period. It intentionally weights complexity higher than raw count to avoid rewarding engineers who simply merge many trivial changes.',
    formula: 'Velocity = 0.40 × Consistency + 0.60 × Complexity',
    signals: [
      {
        name: 'Consistency (40%)',
        calc: 'min(prs_created / max_prs_in_population, 1) × 100',
        explanation:
          'Measures PR output relative to the most prolific contributor in the dataset. The engineer with the most PRs scores 100, and all others are proportionally scored. This adapts automatically to any data window without requiring a fixed monthly threshold.',
        icon: GitPullRequest,
      },
      {
        name: 'Complexity (60%)',
        calc: 'min(avg_files_per_PR / max_avg_files_in_population, 1) × 100',
        explanation:
          'Captures the average number of files touched per PR, normalized against the population maximum. The engineer with the highest avg files/PR scores 100. This ensures cross-cutting, architecturally significant work is recognized. Carries 60% weight to emphasize complexity over volume.',
        icon: FileCode,
      },
    ],
  },
  {
    name: 'Collaboration',
    weight: 20,
    color: '#f59e0b',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    badgeClass: 'bg-amber-500 text-white',
    icon: Users,
    rationale:
      'Collaboration reflects how much an engineer invests in their teammates\u2019 success through code review. A high-impact collaborator provides both breadth (reviewing many PRs) and depth (leaving substantive feedback), rather than simply approving without comment.',
    formula: 'Collaboration = 0.70 × Review Volume + 0.30 × Review Depth',
    signals: [
      {
        name: 'Review Volume (70%)',
        calc: 'min(reviews_given / max_reviews_in_population, 1) × 100',
        explanation:
          'Counts the total number of review events an engineer has submitted, normalized against the population maximum. The most active reviewer scores 100. The higher weight (70%) reflects that consistent participation across the team\u2019s work is the strongest signal of collaborative behavior.',
        icon: MessageSquare,
      },
      {
        name: 'Review Depth (30%)',
        calc: 'min((reviews_given / PRs_reviewed) / 3, 1) × 100',
        explanation:
          'Measures the average number of review submissions per unique PR reviewed. A ratio of 1.0 indicates a single review per PR (likely a quick approval). A ratio of 3.0 or higher suggests the engineer engaged in multiple rounds of feedback, follow-up questions, or iterative discussion — a hallmark of thorough, high-value reviews. This metric specifically penalizes "rubber-stamp" approvals.',
        icon: MessageSquare,
      },
    ],
  },
  {
    name: 'Technical Leadership',
    weight: 20,
    color: '#8b5cf6',
    bgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-500/30',
    badgeClass: 'bg-violet-500 text-white',
    icon: Crown,
    rationale:
      'Technical leadership identifies engineers who serve as go-to experts. Leaders touch a wide surface area of the codebase and contribute in both authoring and reviewing roles, demonstrating broad system knowledge and the trust of their peers.',
    formula: 'Leadership = 0.60 × Code Ownership + 0.40 × Balance',
    signals: [
      {
        name: 'Code Ownership (60%)',
        calc: 'min(total_files_changed / max_files_in_population, 1) × 100',
        explanation:
          'Measures the total number of files an engineer has modified, normalized against the population maximum. The engineer with the widest codebase footprint scores 100. This deliberately measures breadth of ownership rather than depth in a single module, reflecting the type of cross-team influence expected from technical leaders.',
        icon: FileCode,
      },
      {
        name: 'Balance (40%)',
        calc: 'min((PRs + reviews) / max_combined_in_population, 1) × 100  (0 if either is zero)',
        explanation:
          'Evaluates whether an engineer contributes in both dimensions: writing code and reviewing others\u2019 code. The combined count is normalized against the population maximum. Critically, if an engineer has zero PRs or zero reviews, the balance score is 0 — regardless of how strong the other side is. This prevents one-dimensional contributors from scoring on leadership.',
        icon: Scale,
      },
    ],
  },
];

const antiGaming = [
  {
    attack: 'Spam tiny PRs',
    defense: 'Velocity allocates 60% weight to complexity (files per PR), not raw PR count. Trivial single-file PRs contribute minimal velocity score.',
  },
  {
    attack: 'Inflate with large PRs',
    defense: 'Quality penalizes PRs outside the 200–500 line sweet spot. Oversized PRs receive a progressively lower size score, floored at 50.',
  },
  {
    attack: 'Rubber-stamp reviews',
    defense: 'Collaboration measures review depth (average submissions per PR). A single approval per PR yields a depth ratio of 1.0 out of a 3.0 target — only 33%.',
  },
  {
    attack: 'Only write code, never review',
    defense: 'Leadership balance score drops to 0 if either PRs authored or reviews given is zero. Both roles are required.',
  },
  {
    attack: 'Only review, never ship code',
    defense: 'Quality, velocity, and leadership all depend on PR authorship. Review-only contributors score 0 on those dimensions.',
  },
];

export function Methodology() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Scoring Methodology</CardTitle>
          <CardDescription className="text-base">
            A transparent breakdown of how engineering impact scores are calculated — from raw GitHub data to the final ranking.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Approach Overview */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Approach
            </h3>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm text-muted-foreground leading-relaxed">
              <p>
                Impact is measured across four independent dimensions, each scored on a 0–100 scale and combined into a single weighted composite. The methodology is designed around three principles:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><span className="font-medium text-foreground">Multi-dimensional measurement.</span> No single metric determines the ranking. Engineers must demonstrate strength across code quality, delivery, collaboration, and technical leadership.</li>
                <li><span className="font-medium text-foreground">Quality over quantity.</span> Raw counts (lines of code, commit frequency) are intentionally excluded. Every metric is either rate-based, ratio-based, or normalized to prevent volume inflation.</li>
                <li><span className="font-medium text-foreground">Resistance to gaming.</span> The formula cross-checks dimensions against each other. Inflating one metric (e.g., PR count) without the corresponding depth (e.g., file complexity) produces diminishing returns.</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Data Pipeline */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Step 1 — Data Collection
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5">
                <Database className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">GitHub REST API</span>
              </div>
              <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5">
                <GitPullRequest className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Merged PRs + Reviews</span>
              </div>
              <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5">
                <Calculator className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Per-contributor aggregation</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              For each merged pull request, the following fields are collected and aggregated per contributor. Contributors with fewer than 2 merged PRs are excluded from scoring to ensure statistical significance.
            </p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {[
                'PRs created',
                'Lines added / deleted',
                'Files changed',
                'Avg time to merge (hours)',
                'Reviews given',
                'Unique PRs reviewed',
              ].map((stat) => (
                <div key={stat} className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground text-center">
                  {stat}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Overall Formula */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Step 2 — Composite Impact Score
            </h3>
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                  Each dimension is scored independently on a 0–100 scale, then combined with fixed weights.
                </p>
                <p className="font-mono text-base sm:text-lg font-semibold tracking-tight">
                  Impact&nbsp;=&nbsp;
                  <span className="text-blue-500">0.30</span>&thinsp;×&thinsp;Quality&nbsp;+&nbsp;
                  <span className="text-emerald-500">0.30</span>&thinsp;×&thinsp;Velocity&nbsp;+&nbsp;
                  <span className="text-amber-500">0.20</span>&thinsp;×&thinsp;Collaboration&nbsp;+&nbsp;
                  <span className="text-violet-500">0.20</span>&thinsp;×&thinsp;Leadership
                </p>
              </div>
              <div className="flex justify-center gap-3 mt-4">
                {dimensions.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="size-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-xs font-medium">{d.name} ({d.weight}%)</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Quality and velocity each carry 30% weight because they represent the core output expectations of an engineer — writing good code and shipping it reliably. Collaboration and leadership each carry 20% because they represent multiplier behaviors that amplify team-wide performance.
            </p>
          </div>

          <Separator />

          {/* Dimension Breakdowns */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Step 3 — Dimension Formulas
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {dimensions.map((dim) => {
                const Icon = dim.icon;
                return (
                  <Card key={dim.name} className={`shadow-none border-2 ${dim.borderClass}`}>
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`size-9 rounded-lg flex items-center justify-center ${dim.bgClass}`}>
                            <Icon className="size-5" style={{ color: dim.color }} />
                          </div>
                          <CardTitle className="text-lg">{dim.name}</CardTitle>
                        </div>
                        <Badge className={dim.badgeClass}>{dim.weight}%</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Rationale */}
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {dim.rationale}
                      </p>

                      {/* Formula */}
                      <div className="rounded-lg bg-muted/60 px-4 py-2.5">
                        <p className="font-mono text-sm" style={{ color: dim.color }}>
                          {dim.formula}
                        </p>
                      </div>

                      {/* Signals */}
                      <div className="space-y-4">
                        {dim.signals.map((signal) => {
                          const SIcon = signal.icon;
                          return (
                            <div key={signal.name} className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <SIcon className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm font-semibold">{signal.name}</span>
                              </div>
                              <div className="ml-5.5 space-y-1">
                                <div className="rounded bg-muted/50 px-3 py-1.5">
                                  <p className="font-mono text-xs text-muted-foreground">{signal.calc}</p>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{signal.explanation}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Anti-Gaming */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Anti-Gaming Properties
            </h3>
            <Alert>
              <ShieldAlert className="size-4" />
              <AlertTitle>Designed to resist manipulation</AlertTitle>
              <AlertDescription>
                <p className="mt-1 text-sm text-muted-foreground">
                  Each potential gaming strategy is counterbalanced by at least one dimension that penalizes the behavior.
                </p>
                <div className="mt-3 space-y-2.5">
                  {antiGaming.map((item) => (
                    <div key={item.attack} className="flex gap-3 text-sm">
                      <Badge variant="outline" className="shrink-0 text-xs font-normal h-5 mt-0.5">
                        {item.attack}
                      </Badge>
                      <span className="text-muted-foreground">{item.defense}</span>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          </div>

          <Separator />

          {/* Limitations */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Known Limitations
            </h3>
            <Alert variant="default">
              <Info className="size-4" />
              <AlertTitle>What this model does not capture</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
                  <li>Impact from non-PR work such as design documents, incident response, or mentorship.</li>
                  <li>Code review quality beyond submission count — the depth metric approximates engagement but cannot assess the substance of individual comments.</li>
                  <li>Team context — a senior engineer mentoring three juniors may show lower personal output while generating higher team-wide impact.</li>
                  <li>Repository-specific norms — the 200–500 line PR sweet spot is an industry heuristic. Population-relative normalization adapts thresholds automatically, but the PR size sweet spot remains fixed.</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
