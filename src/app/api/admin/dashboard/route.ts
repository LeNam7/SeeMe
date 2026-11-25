import { NextResponse } from 'next/server';
import { desc, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';
import { expireStaleHolds, getAvailabilityForRange } from '@/lib/booking-engine';
import { addDays, getTodayVnDate } from '@/lib/dates';

export async function GET() {
  try {
    await ensureSeeded();
    const { errorResponse } = await requireAdminApi();
    if (errorResponse) return errorResponse;

    await expireStaleHolds();
    const today = getTodayVnDate();
    const allBookings = await db
      .select()
      .from(schema.bookings)
      .orderBy(desc(schema.bookings.createdAt));

    const allPayments = await db
      .select()
      .from(schema.payments)
      .orderBy(desc(schema.payments.createdAt));

    const allNotifs = await db
      .select()
      .from(schema.notificationLogs)
      .orderBy(desc(schema.notificationLogs.createdAt))
      .limit(20);

    const activeTodayAvail = await getAvailabilityForRange(today, addDays(today, 1));
    const totalRoomUnits = activeTodayAvail.rooms.reduce((s, r) => s + r.totalUnits, 0);
    const occupiedToday = activeTodayAvail.rooms.reduce(
      (s, r) => s + r.dates.filter((d) => d.bookedUnits > 0).reduce((a, b) => a + b.bookedUnits, 0),
      0
    );

    const confirmedRevenue = allBookings
      .filter((b) => b.paymentStatus === 'PAID')
      .reduce((s, b) => s + b.totalAmount, 0);

    const bookingIds = allBookings.slice(0, 30).map((b) => b.id);
    const items =
      bookingIds.length > 0
        ? await db
            .select()
            .from(schema.bookingItems)
            .where(inArray(schema.bookingItems.bookingId, bookingIds))
        : [];

    const recentBookings = allBookings.slice(0, 12).map((b) => ({
      ...b,
      items: items.filter((it) => it.bookingId === b.id),
    }));

    return NextResponse.json({
      today,
      kpis: {
        pendingCount: allBookings.filter((b) => b.status === 'PENDING').length,
        awaitingPaymentCount: allBookings.filter((b) =>
          ['AWAITING_PAYMENT', 'PENDING', 'APPROVED'].includes(b.status)
        ).length,
        confirmedCount: allBookings.filter((b) => b.status === 'CONFIRMED').length,
        checkInsTodayCount: allBookings.filter(
          (b) => b.checkInDate === today && ['CONFIRMED', 'AWAITING_PAYMENT', 'APPROVED'].includes(b.status)
        ).length,
        occupancyTodayPercent:
          totalRoomUnits > 0 ? Math.round((occupiedToday / totalRoomUnits) * 100) : 0,
        confirmedRevenue,
      },
      recentBookings,
      recentPayments: allPayments.slice(0, 10),
      recentNotifications: allNotifs,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi tải Dashboard Admin.' },
      { status: 500 }
    );
  }
}
