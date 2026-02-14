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

const POLL_INTERVAL = 5 * 60 * 1000;

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function Dashboard() {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selected, setSelected] = useState<Engineer | null>(null);
  const [dateRange, setDateRange] = useState<{ from: string; to: string; months: number } | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
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
      setTotalPRsAll(data.totalPRs);
      if (isInitial && data.engineers.length > 0) setSelected(data.engineers[0]);
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

  useEffect(() => { fetchData(true); }, [fetchData]);
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(false), POLL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
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
            <RefreshCw className="size-4" /> Retry
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-white/80 dark:bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <Activity className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Engineering Impact
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>PostHog/posthog</span>
                <span className="opacity-40">·</span>
                <span>
                  {dateRange && dateRange.from
                    ? `${dateRange.from} — ${dateRange.to}`
                    : 'All time'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex size-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
                </span>
                Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <Badge variant="secondary" className="gap-1 text-xs">
              <Users className="size-3" />
              {engineers.length} Engineers
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Active Contributors" value={engineers.length} icon={<Users className="size-4" />} color="blue" />
          <KpiCard label="PRs Merged" value={formatNumber(totalPRsAll || totalPRs)} icon={<GitPullRequest className="size-4" />} color="emerald" />
          <KpiCard label="Code Reviews" value={formatNumber(totalReviews)} icon={<MessageSquareText className="size-4" />} color="amber" />
          <KpiCard label="Avg Impact Score" value={avgScore} icon={<Activity className="size-4" />} color="violet" />
          <KpiCard label="Avg Merge Time" value={`${avgMerge}h`} icon={<Clock className="size-4" />} color="rose" />
          <KpiCard label="Top Impact Score" value={engineers[0]?.impact_score ?? 0} icon={<Zap className="size-4" />} color="yellow" />
        </div>

        {/* Insights Row */}
        {insights.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Key Insights
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {insights.map((insight) => (
                <InsightCard key={insight.label} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {/* Tabs */}
        <Tabs defaultValue="leaderboard">
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="leaderboard" className="gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <LayoutGrid className="size-3.5" /> Leaderboard
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Table2 className="size-3.5" /> Detailed View
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <TrendingUp className="size-3.5" /> Trends Analysis
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <GitCompareArrows className="size-3.5" /> Comparison
            </TabsTrigger>
            <TabsTrigger value="methodology" className="gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BookOpen className="size-3.5" /> Methodology
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Leaderboard engineers={engineers} onSelect={setSelected} selected={selected} />
              {selected && <ImpactChart engineer={selected} />}
            </div>
          </TabsContent>

          <TabsContent value="table" className="mt-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <EngineersTable engineers={engineers} onSelect={setSelected} selected={selected} />
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

        <footer className="pt-6 pb-4 border-t text-center text-muted-foreground text-xs">
          Built for <span className="font-medium text-foreground/70">Weave (YC W25)</span> · PostHog/posthog · Auto-refreshes every 5 min
        </footer>
      </main>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  blue:    { bg: 'bg-blue-50 dark:bg-blue-950/30',    text: 'text-blue-600 dark:text-blue-400',    ring: 'ring-blue-200 dark:ring-blue-800' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-950/30',   text: 'text-amber-600 dark:text-amber-400',   ring: 'ring-amber-200 dark:ring-amber-800' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-950/30',  text: 'text-violet-600 dark:text-violet-400',  ring: 'ring-violet-200 dark:ring-violet-800' },
  rose:    { bg: 'bg-rose-50 dark:bg-rose-950/30',    text: 'text-rose-600 dark:text-rose-400',    ring: 'ring-rose-200 dark:ring-rose-800' },
  yellow:  { bg: 'bg-yellow-50 dark:bg-yellow-950/30',  text: 'text-yellow-600 dark:text-yellow-400',  ring: 'ring-yellow-200 dark:ring-yellow-800' },
};

function KpiCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <div className={`rounded-xl border bg-card p-4 ring-1 ${c.ring} ring-inset`}>
      <div className={`inline-flex items-center justify-center size-8 rounded-lg ${c.bg} ${c.text} mb-2`}>
        {icon}
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ── Insight Card ─────────────────────────────────────────────────────

const INSIGHT_ICONS: Record<string, React.ReactNode> = {
  'Fastest Merger':     <Zap className="size-4 text-yellow-500" />,
  'Review Champion':    <MessageSquareText className="size-4 text-blue-500" />,
  'Most Prolific':      <Rocket className="size-4 text-emerald-500" />,
  'Broadest Reach':     <FolderTree className="size-4 text-violet-500" />,
  'Most Well-Rounded':  <Star className="size-4 text-amber-500" />,
};

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-1.5 mb-3">
        {INSIGHT_ICONS[insight.label] ?? <Zap className="size-4" />}
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {insight.label}
        </span>
      </div>
      <div className="flex items-center gap-2.5 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={insight.avatar_url} alt={insight.name} className="size-8 rounded-full ring-2 ring-background shadow-sm" />
        <span className="text-sm font-semibold truncate">{insight.name || insight.username}</span>
      </div>
      <p className="text-xl font-bold tabular-nums">{insight.value}</p>
      <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">{insight.description}</p>
    </div>
  );
}
