import { NextRequest, NextResponse } from 'next/server';
import { BookingError, confirmGuestBookingPayment } from '@/lib/booking-engine';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const cleanCode = decodeURIComponent(code).trim().toUpperCase();
    const booking = await confirmGuestBookingPayment(cleanCode);
    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Không thể xác nhận thanh toán lúc này.' },
      { status: 500 }
    );
  }
}
