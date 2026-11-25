import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded } from '@/db/seed';
import { getAvailabilityForRange } from '@/lib/booking-engine';
import { addDays, getTodayVnDate, isValidIsoDate } from '@/lib/dates';

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    const today = getTodayVnDate();
    const checkIn = searchParams.get('checkIn') || addDays(today, 1);
    const checkOut = searchParams.get('checkOut') || addDays(checkIn, 2);
    const roomIdParam = searchParams.get('roomId');
    const roomId = roomIdParam ? Number(roomIdParam) : undefined;

    if (!isValidIsoDate(checkIn) || !isValidIsoDate(checkOut) || checkOut <= checkIn) {
      return NextResponse.json(
        { error: 'Khoảng ngày check-in / check-out không hợp lệ.' },
        { status: 400 }
      );
    }

    const result = await getAvailabilityForRange(checkIn, checkOut, roomId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Không thể kiểm tra lịch trống.' },
      { status: 500 }
    );
  }
}
