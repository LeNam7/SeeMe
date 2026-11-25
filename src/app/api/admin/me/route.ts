import { NextResponse } from 'next/server';
import { ensureSeeded } from '@/db/seed';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  await ensureSeeded();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, username: session.username });
}
