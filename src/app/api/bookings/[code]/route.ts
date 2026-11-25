import { NextRequest, NextResponse } from 'next/server';
import { eq, asc, desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { expireStaleHolds } from '@/lib/booking-engine';
import { getAllSiteSettings } from '@/lib/settings';
import { getExternalVietQrUrl } from '@/lib/vietqr';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    await ensureSeeded();
    await expireStaleHolds();

    const { code } = await context.params;
    const cleanCode = decodeURIComponent(code).trim().toUpperCase();

    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.bookingCode, cleanCode));

    if (!booking) {
      return NextResponse.json({ error: 'Không tìm thấy mã đơn đặt phòng.' }, { status: 404 });
    }

    const items = await db
      .select()
      .from(schema.bookingItems)
      .where(eq(schema.bookingItems.bookingId, booking.id));

    const services = await db
      .select()
      .from(schema.bookingServices)
      .where(eq(schema.bookingServices.bookingId, booking.id));

    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.bookingId, booking.id))
      .orderBy(desc(schema.payments.id));

    const history = await db
      .select()
      .from(schema.bookingStatusHistory)
      .where(eq(schema.bookingStatusHistory.bookingId, booking.id))
      .orderBy(asc(schema.bookingStatusHistory.createdAt));

    const settings = await getAllSiteSettings();

    const externalQrUrl = payment
      ? getExternalVietQrUrl({
          bankBin: payment.bankBin,
          accountNo: payment.accountNo,
          template: settings.payment.template,
          amount: payment.amount,
          transferContent: payment.transferContent,
          accountName: payment.accountName,
        })
      : null;

    return NextResponse.json({
      booking,
      items,
      services,
      payment: payment ? { ...payment, externalQrUrl } : null,
      history,
      brand: settings.brand,
      policy: settings.policy,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi tải đơn đặt phòng.' },
      { status: 500 }
    );
  }
}
