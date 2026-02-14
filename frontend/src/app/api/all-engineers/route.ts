import { NextResponse } from 'next/server';
import { getAllEngineers } from '@/lib/analyzer';

export async function GET() {
  return NextResponse.json(getAllEngineers());
}
