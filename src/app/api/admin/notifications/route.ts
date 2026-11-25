import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';
import { retryZaloNotification } from '@/lib/zalo';

export async function GET() {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const logs = await db
    .select()
    .from(schema.notificationLogs)
    .orderBy(desc(schema.notificationLogs.createdAt))
    .limit(80);
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const logId = Number(body.logId);
  if (!Number.isInteger(logId) || logId <= 0) {
    return NextResponse.json({ error: 'Thiếu ID bản ghi thông báo.' }, { status: 400 });
  }
  const log = await retryZaloNotification(logId);
  return NextResponse.json({ log });
}
