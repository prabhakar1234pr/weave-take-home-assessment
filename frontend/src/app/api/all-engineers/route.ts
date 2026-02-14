import { NextResponse } from 'next/server';
import { getAllEngineers, getDataDateRange } from '@/lib/analyzer';

export async function GET() {
  return NextResponse.json({
    engineers: getAllEngineers(),
    dateRange: getDataDateRange(),
  });
}
