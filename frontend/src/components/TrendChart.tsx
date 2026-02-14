'use client';

import { useEffect, useState, useCallback } from 'react';
import { getTrends } from '@/lib/api';
import { TrendData } from '@/types/engineer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

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

  const fetchData = useCallback(
    async (preset: string) => {
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
    },
    []
  );

  // Fetch on mount, preset change, or refresh
  useEffect(() => {
    fetchData(activePreset);
  }, [activePreset, refreshKey, fetchData]);

  const handlePresetClick = (label: string) => {
    setActivePreset(label);
  };

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Weekly PR Activity</CardTitle>
            <CardDescription>
              Merged pull requests per week for the top 5 engineers
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {TIME_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={activePreset === preset.label ? 'default' : 'outline'}
                size="sm"
                className="text-xs px-3 h-7"
                onClick={() => handlePresetClick(preset.label)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.series.length === 0 ? (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
            No trend data available for this time range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart
              data={data.series}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="week"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                }}
                labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
              />
              <Legend wrapperStyle={{ fontSize: '13px', paddingTop: 12 }} />
              {data.engineers.map((eng, i) => (
                <Line
                  key={eng.username}
                  type="monotone"
                  dataKey={eng.username}
                  name={eng.name || eng.username}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
