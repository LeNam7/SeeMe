import { NextResponse } from 'next/server';
import { desc, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';

export async function GET() {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const pays = await db
    .select()
    .from(schema.payments)
    .orderBy(desc(schema.payments.createdAt));
  const ids = pays.map((p) => p.bookingId);
  const bks =
    ids.length > 0
      ? await db.select().from(schema.bookings).where(inArray(schema.bookings.id, ids))
      : [];
  const map = new Map(bks.map((b) => [b.id, b]));

  return NextResponse.json({
    payments: pays.map((p) => ({
      ...p,
      bookingCode: map.get(p.bookingId)?.bookingCode || '',
      customerName: map.get(p.bookingId)?.customerName || '',
      customerPhone: map.get(p.bookingId)?.customerPhone || '',
    })),
  });
}
