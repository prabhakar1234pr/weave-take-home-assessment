'use client';

import { useEffect, useState, useCallback } from 'react';
import { getTrends } from '@/lib/api';
import { TrendData } from '@/types/engineer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = [
  { stroke: '#3b82f6', fill: '#3b82f6' },
  { stroke: '#10b981', fill: '#10b981' },
  { stroke: '#f59e0b', fill: '#f59e0b' },
  { stroke: '#8b5cf6', fill: '#8b5cf6' },
  { stroke: '#ef4444', fill: '#ef4444' },
];

const TIME_PRESETS = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 0 },
] as const;

interface Props {
  refreshKey?: number;
}

export function TrendChart({ refreshKey }: Props) {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState('All');

  const fetchData = useCallback(async (preset: string) => {
    setLoading(true);
    try {
      const selected = TIME_PRESETS.find((p) => p.label === preset);
      const opts: { from?: string; to?: string } = {};
      if (selected && selected.days > 0) {
        const from = new Date();
        from.setDate(from.getDate() - selected.days);
        opts.from = from.toISOString();
      }
      const result = await getTrends(opts);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch trends:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activePreset);
  }, [activePreset, refreshKey, fetchData]);

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">PR Activity Over Time</CardTitle>
            <CardDescription className="text-xs">
              Weekly merged pull requests for the top 5 contributors
            </CardDescription>
          </div>
          <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
            {TIME_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={activePreset === preset.label ? 'default' : 'ghost'}
                size="sm"
                className={`text-[11px] px-2.5 h-6 rounded-md ${
                  activePreset === preset.label
                    ? 'shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActivePreset(preset.label)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pr-2">
        {!data || data.series.length === 0 ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
            No trend data available for this time range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={data.series} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <defs>
                {data.engineers.map((eng, i) => {
                  const c = COLORS[i % COLORS.length];
                  return (
                    <linearGradient key={eng.username} id={`gradient-${eng.username}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.fill} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={c.fill} stopOpacity={0.01} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '10px',
                  color: 'hsl(var(--popover-foreground))',
                  fontSize: '12px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4, fontSize: '12px' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: 16 }}
                iconType="circle"
                iconSize={8}
              />
              {data.engineers.map((eng, i) => {
                const c = COLORS[i % COLORS.length];
                return (
                  <Area
                    key={eng.username}
                    type="monotone"
                    dataKey={eng.username}
                    name={eng.name || eng.username}
                    stroke={c.stroke}
                    strokeWidth={2}
                    fill={`url(#gradient-${eng.username})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: c.stroke }}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
