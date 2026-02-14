'use client';

import { useEffect, useState } from 'react';
import { getTrends } from '@/lib/api';
import { TrendData } from '@/types/engineer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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

export function TrendChart() {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrends()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
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

  if (!data || data.series.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly PR Activity</CardTitle>
          <CardDescription>No trend data available.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly PR Activity</CardTitle>
        <CardDescription>
          Merged pull requests per week for the top 5 engineers over the last 90 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={data.series} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
            <Legend
              wrapperStyle={{ fontSize: '13px', paddingTop: 12 }}
            />
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
      </CardContent>
    </Card>
  );
}
