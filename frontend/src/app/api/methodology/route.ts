import { NextResponse } from 'next/server';
import { getMethodology } from '@/lib/analyzer';

export async function GET() {
  return NextResponse.json(getMethodology());
}
