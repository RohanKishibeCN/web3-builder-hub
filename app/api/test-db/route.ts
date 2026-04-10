import { NextResponse } from 'next/server';
import { fetchProjects } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const projects = await fetchProjects();
  return NextResponse.json({ projects });
}
