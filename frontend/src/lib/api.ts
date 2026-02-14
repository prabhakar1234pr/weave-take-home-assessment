import { Engineer, Methodology, TrendData } from '@/types/engineer';

export interface DateRange {
  from: string;
  to: string;
  months: number;
}

export async function getTopEngineers(): Promise<Engineer[]> {
  const response = await fetch('/api/top-engineers?limit=5');
  if (!response.ok) {
    throw new Error('Failed to fetch engineers');
  }
  return response.json();
}

export async function getAllEngineers(): Promise<{
  engineers: Engineer[];
  dateRange: DateRange;
}> {
  const response = await fetch('/api/all-engineers');
  if (!response.ok) {
    throw new Error('Failed to fetch engineers');
  }
  return response.json();
}

export async function getTrends(): Promise<TrendData> {
  const response = await fetch('/api/trends?top=5');
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
