import { NextRequest, NextResponse } from 'next/server';
import { desc, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';
import { expireStaleHolds } from '@/lib/booking-engine';

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded();
    const { errorResponse } = await requireAdminApi();
    if (errorResponse) return errorResponse;

    await expireStaleHolds();

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || '';
    const payFilter = searchParams.get('paymentStatus') || '';
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    let rows = await db
      .select()
      .from(schema.bookings)
      .orderBy(desc(schema.bookings.createdAt));

    if (statusFilter && statusFilter !== 'ALL') {
      rows = rows.filter((b) => b.status === statusFilter);
    }
    if (payFilter && payFilter !== 'ALL') {
      rows = rows.filter((b) => b.paymentStatus === payFilter);
    }
    if (q) {
      rows = rows.filter(
        (b) =>
          b.bookingCode.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.customerPhone.toLowerCase().includes(q) ||
          (b.customerEmail || '').toLowerCase().includes(q)
      );
    }

    const ids = rows.map((b) => b.id);
    const items =
      ids.length > 0
        ? await db.select().from(schema.bookingItems).where(inArray(schema.bookingItems.bookingId, ids))
        : [];
    const services =
      ids.length > 0
        ? await db
            .select()
            .from(schema.bookingServices)
            .where(inArray(schema.bookingServices.bookingId, ids))
        : [];
    const pays =
      ids.length > 0
        ? await db.select().from(schema.payments).where(inArray(schema.payments.bookingId, ids))
        : [];
    const histories =
      ids.length > 0
        ? await db
            .select()
            .from(schema.bookingStatusHistory)
            .where(inArray(schema.bookingStatusHistory.bookingId, ids))
        : [];

    const enriched = rows.map((b) => ({
      ...b,
      items: items.filter((it) => it.bookingId === b.id),
      services: services.filter((sv) => sv.bookingId === b.id),
      payments: pays.filter((py) => py.bookingId === b.id),
      history: histories.filter((hs) => hs.bookingId === b.id),
    }));

    return NextResponse.json({ bookings: enriched });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi tải danh sách đơn.' },
      { status: 500 }
    );
  }
}
