'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getAllEngineers, DashboardData } from '@/lib/api';
import { Engineer, Insight } from '@/types/engineer';
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
  Clock,
  Zap,
  MessageSquareText,
  Rocket,
  FolderTree,
  Star,
} from 'lucide-react';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function Dashboard() {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selected, setSelected] = useState<Engineer | null>(null);
  const [dateRange, setDateRange] = useState<{ from: string; to: string; months: number } | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [totalPRsAll, setTotalPRsAll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      const data: DashboardData = await getAllEngineers();
      setEngineers(data.engineers);
      setDateRange(data.dateRange);
      setInsights(data.insights);
      setFetchedAt(data.fetchedAt);
      setTotalPRsAll(data.totalPRs);
      if (isInitial && data.engineers.length > 0) {
        setSelected(data.engineers[0]);
      }
      setLastRefresh(new Date());
      setRefreshKey((k) => k + 1);
      if (isInitial) setLoading(false);
    } catch (err) {
      if (isInitial) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Polling every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(false), POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

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
  const avgMerge = engineers.length
    ? (engineers.reduce((s, e) => s + e.stats.avg_merge_time, 0) / engineers.length).toFixed(1)
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                PostHog/posthog
                {dateRange && dateRange.from
                  ? ` · ${dateRange.from} — ${dateRange.to}`
                  : ' · All time'}
              </span>
              {lastRefresh && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="flex items-center gap-1">
                    <span className="relative flex size-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2 bg-green-500" />
                    </span>
                    Live &middot; updated{' '}
                    {lastRefresh.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1.5 py-1">
              <Users className="size-3.5" />
              {engineers.length} contributors
            </Badge>
            <Badge variant="secondary" className="gap-1.5 py-1">
              <GitPullRequest className="size-3.5" />
              {totalPRsAll || totalPRs} PRs
            </Badge>
            <Badge variant="secondary" className="gap-1.5 py-1">
              <Activity className="size-3.5" />
              {avgScore} avg impact
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="Contributors" value={engineers.length} icon={<Users className="size-4 text-blue-500" />} />
          <KpiCard label="PRs Merged" value={totalPRsAll || totalPRs} icon={<GitPullRequest className="size-4 text-emerald-500" />} />
          <KpiCard label="Reviews" value={totalReviews} icon={<MessageSquareText className="size-4 text-amber-500" />} />
          <KpiCard label="Avg Impact" value={avgScore} icon={<Activity className="size-4 text-violet-500" />} />
          <KpiCard label="Avg Merge" value={`${avgMerge}h`} icon={<Clock className="size-4 text-rose-500" />} />
          <KpiCard
            label="Top Score"
            value={engineers[0]?.impact_score ?? 0}
            icon={<Zap className="size-4 text-yellow-500" />}
          />
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {insights.map((insight) => (
              <InsightCard key={insight.label} insight={insight} />
            ))}
          </div>
        )}

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

          <TabsContent value="trends" className="mt-6">
            <TrendChart refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="compare" className="mt-6">
            <CompareView engineers={engineers} />
          </TabsContent>

          <TabsContent value="methodology" className="mt-6">
            <Methodology />
          </TabsContent>
        </Tabs>

        <footer className="pt-6 pb-4 border-t text-center text-muted-foreground text-sm">
          Built for Weave (YC W25) &middot; Data from PostHog/posthog repository
          &middot; Auto-refreshes every 5 minutes
        </footer>
      </main>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

const INSIGHT_ICONS: Record<string, React.ReactNode> = {
  'Fastest Merger': <Zap className="size-4 text-yellow-500" />,
  'Review Champion': <MessageSquareText className="size-4 text-blue-500" />,
  'Most Prolific': <Rocket className="size-4 text-emerald-500" />,
  'Broadest Reach': <FolderTree className="size-4 text-violet-500" />,
  'Most Well-Rounded': <Star className="size-4 text-amber-500" />,
};

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {INSIGHT_ICONS[insight.label] ?? <Zap className="size-4" />}
        <span className="text-xs font-semibold text-muted-foreground">
          {insight.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={insight.avatar_url}
          alt={insight.name}
          className="size-6 rounded-full"
        />
        <span className="text-sm font-medium truncate">
          {insight.name || insight.username}
        </span>
      </div>
      <div className="text-lg font-bold tabular-nums">{insight.value}</div>
      <p className="text-[10px] text-muted-foreground leading-tight">
        {insight.description}
      </p>
    </div>
  );
}
