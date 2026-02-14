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
    formula: '0.50 × Merge Speed  +  0.30 × PR Size  +  0.20 × Review Activity',
    signals: [
      {
        name: 'Merge Speed',
        calc: '100 × (1 − min(hours, 72) / 72)',
        why: 'Good code gets approved fast. Capped at 72h.',
        icon: Clock,
      },
      {
        name: 'PR Size',
        calc: '100 if avg lines ∈ [200, 500], scales down outside',
        why: 'Too small = trivial, too large = unreadable.',
        icon: FileCode,
      },
      {
        name: 'Review Activity',
        calc: 'min(reviews_given / 20, 1) × 100',
        why: 'Engineers who review others understand quality.',
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
    formula: '0.40 × Consistency  +  0.60 × Complexity',
    signals: [
      {
        name: 'Consistency',
        calc: 'min(PRs_per_month / 10, 1) × 100',
        why: 'Steady delivery beats sporadic bursts. 10+/mo = 100.',
        icon: GitPullRequest,
      },
      {
        name: 'Complexity',
        calc: 'min(avg_files_per_PR / 15, 1) × 100',
        why: 'Many files per PR = cross-cutting, complex work.',
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
    formula: '0.70 × Review Volume  +  0.30 × Review Depth',
    signals: [
      {
        name: 'Review Volume',
        calc: 'min(reviews_given / 30, 1) × 100',
        why: 'Helping teammates. 30+ reviews = full marks.',
        icon: MessageSquare,
      },
      {
        name: 'Review Depth',
        calc: 'min(reviews / PRs_reviewed / 3, 1) × 100',
        why: 'Multiple comments per PR = substantive, not rubber stamps.',
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
    formula: '0.60 × Code Ownership  +  0.40 × Balance',
    signals: [
      {
        name: 'Code Ownership',
        calc: 'min(files_changed / 200, 1) × 100',
        why: 'Wide codebase knowledge. 200+ files = full marks.',
        icon: FileCode,
      },
      {
        name: 'Balance',
        calc: 'min((PRs + reviews) / 40, 1) × 100',
        why: 'Must both author AND review. Zero if only doing one.',
        icon: Scale,
      },
    ],
  },
];

const antiGaming = [
  { attack: 'Spam tiny PRs', defense: 'Velocity weights complexity (files/PR), not just count' },
  { attack: 'Make huge PRs', defense: 'Quality penalizes PRs outside the 200–500 line sweet spot' },
  { attack: 'Rubber-stamp reviews', defense: 'Collaboration measures depth (comments/PR), not just approvals' },
  { attack: 'Only write OR only review', defense: 'Leadership requires both — zero if only doing one' },
];

export function Methodology() {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">How We Calculate Impact</CardTitle>
          <CardDescription className="text-base">
            From raw GitHub data to multi-dimensional impact scores — every formula explained.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Step 1: Data Pipeline */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Step 1 — Data Collection
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5">
                <Database className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">GitHub API</span>
              </div>
              <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5">
                <GitPullRequest className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">All merged PRs</span>
              </div>
              <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5">
                <Calculator className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Per-contributor aggregation</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {[
                'PRs created',
                'Lines added / deleted',
                'Files changed',
                'Avg merge time',
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

          {/* Step 2: Overall Formula */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Step 2 — Overall Impact Formula
            </h3>
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">All scores are 0–100. Engineers with &lt; 2 PRs excluded.</p>
                <p className="font-mono text-base sm:text-lg font-semibold tracking-tight">
                  Impact&nbsp;=&nbsp;
                  <span className="text-blue-500">0.30</span>&thinsp;×&thinsp;Quality&nbsp;+&nbsp;
                  <span className="text-emerald-500">0.30</span>&thinsp;×&thinsp;Velocity&nbsp;+&nbsp;
                  <span className="text-amber-500">0.20</span>&thinsp;×&thinsp;Collab&nbsp;+&nbsp;
                  <span className="text-violet-500">0.20</span>&thinsp;×&thinsp;Leadership
                </p>
              </div>
              <div className="flex justify-center gap-2 mt-4">
                {dimensions.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="size-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-xs font-medium">{d.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Step 3: Dimension Breakdowns */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Step 3 — Dimension Breakdown
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
                      {/* Formula */}
                      <div className="rounded-lg bg-muted/60 px-4 py-2.5">
                        <p className="font-mono text-sm" style={{ color: dim.color }}>
                          {dim.formula}
                        </p>
                      </div>

                      {/* Signals */}
                      <div className="space-y-3">
                        {dim.signals.map((signal) => {
                          const SIcon = signal.icon;
                          return (
                            <div key={signal.name} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <SIcon className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm font-semibold">{signal.name}</span>
                              </div>
                              <div className="ml-5.5 space-y-0.5">
                                <p className="font-mono text-xs text-muted-foreground">{signal.calc}</p>
                                <p className="text-xs text-muted-foreground">{signal.why}</p>
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
              Why This Resists Gaming
            </h3>
            <Alert>
              <ShieldAlert className="size-4" />
              <AlertTitle>Anti-Gaming Design</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-2">
                  {antiGaming.map((item) => (
                    <div key={item.attack} className="flex gap-3 text-sm">
                      <Badge variant="outline" className="shrink-0 text-xs font-normal h-5 mt-0.5">
                        {item.attack}
                      </Badge>
                      <span className="text-muted-foreground">→ {item.defense}</span>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
