'use client';

import { useEffect, useState } from 'react';
import { getAllEngineers, DateRange } from '@/lib/api';
import { Engineer } from '@/types/engineer';
import { Leaderboard } from '@/components/Leaderboard';
import { ImpactChart } from '@/components/ImpactChart';
import { EngineersTable } from '@/components/EngineersTable';
import { TrendChart } from '@/components/TrendChart';
import { CompareView } from '@/components/CompareView';
import { Methodology } from '@/components/Methodology';
import { Loading } from '@/components/Loading';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertCircle,
  LayoutGrid,
  Table2,
  TrendingUp,
  GitCompareArrows,
  BookOpen,
  RefreshCw,
  Activity,
  Users,
  GitPullRequest,
} from 'lucide-react';

export default function Dashboard() {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selected, setSelected] = useState<Engineer | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllEngineers()
      .then(data => {
        setEngineers(data.engineers);
        setDateRange(data.dateRange);
        if (data.engineers.length > 0) setSelected(data.engineers[0]);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full px-4">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Failed to Load Data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => window.location.reload()} className="mt-4 w-full">
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const totalPRs = engineers.reduce((s, e) => s + e.stats.prs_created, 0);
  const totalReviews = engineers.reduce((s, e) => s + e.stats.reviews_given, 0);
  const avgScore = engineers.length
    ? (engineers.reduce((s, e) => s + e.impact_score, 0) / engineers.length).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Engineering Impact Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              PostHog/posthog{dateRange && dateRange.from ? ` · ${dateRange.from} — ${dateRange.to}` : ' · All time'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1.5 py-1">
              <Users className="size-3.5" />
              {engineers.length} contributors
            </Badge>
            <Badge variant="secondary" className="gap-1.5 py-1">
              <GitPullRequest className="size-3.5" />
              {totalPRs} PRs
            </Badge>
            <Badge variant="secondary" className="gap-1.5 py-1">
              <Activity className="size-3.5" />
              {avgScore} avg impact
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard label="Total Contributors" value={engineers.length} />
          <SummaryCard label="Total PRs Merged" value={totalPRs} />
          <SummaryCard label="Total Reviews" value={totalReviews} />
          <SummaryCard label="Avg Impact Score" value={avgScore} />
        </div>

        {/* Main tabs */}
        <Tabs defaultValue="leaderboard">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="leaderboard" className="gap-1.5">
              <LayoutGrid className="size-4" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5">
              <Table2 className="size-4" />
              All Engineers
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-1.5">
              <TrendingUp className="size-4" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-1.5">
              <GitCompareArrows className="size-4" />
              Compare
            </TabsTrigger>
            <TabsTrigger value="methodology" className="gap-1.5">
              <BookOpen className="size-4" />
              Methodology
            </TabsTrigger>
          </TabsList>

          {/* Leaderboard tab */}
          <TabsContent value="leaderboard" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Leaderboard
                engineers={engineers}
                onSelect={setSelected}
                selected={selected}
              />
              {selected && <ImpactChart engineer={selected} />}
            </div>
          </TabsContent>

          {/* Table tab */}
          <TabsContent value="table" className="mt-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <EngineersTable
                  engineers={engineers}
                  onSelect={setSelected}
                  selected={selected}
                />
              </div>
              {selected && (
                <div className="xl:col-span-1">
                  <ImpactChart engineer={selected} />
                </div>
              )}
            </div>
          </TabsContent>

          {/* Trends tab */}
          <TabsContent value="trends" className="mt-6">
            <TrendChart />
          </TabsContent>

          {/* Compare tab */}
          <TabsContent value="compare" className="mt-6">
            <CompareView engineers={engineers} />
          </TabsContent>

          {/* Methodology tab */}
          <TabsContent value="methodology" className="mt-6">
            <Methodology />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="pt-6 pb-4 border-t text-center text-muted-foreground text-sm">
          Built for Weave (YC W25) &middot; Data from PostHog/posthog repository
        </footer>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
