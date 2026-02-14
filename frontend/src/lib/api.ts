import { Engineer, Methodology, TrendData, Insight } from '@/types/engineer';

export interface DateRange {
  from: string;
  to: string;
  months: number;
}

export interface DashboardData {
  engineers: Engineer[];
  dateRange: DateRange;
  insights: Insight[];
  fetchedAt: string | null;
  totalPRs: number;
}

export async function getAllEngineers(): Promise<DashboardData> {
  const response = await fetch(`/api/all-engineers?_t=${Date.now()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch engineers');
  }
  return response.json();
}

export async function getTrends(opts?: {
  from?: string;
  to?: string;
}): Promise<TrendData> {
  const params = new URLSearchParams({ top: '5' });
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  params.set('_t', String(Date.now()));

  const response = await fetch(`/api/trends?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch trends');
  }
  return response.json();
}

export async function getMethodology(): Promise<Methodology> {
  const response = await fetch('/api/methodology');
  if (!response.ok) {
    throw new Error('Failed to fetch methodology');
  }
  return response.json();
}
