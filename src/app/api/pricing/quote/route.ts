import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/db/seed';
import { BookingError, calculateBookingQuote } from '@/lib/booking-engine';

const quoteSchema = z.object({
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestsCount: z.number().int().min(1).max(30),
  roomSelections: z
    .array(
      z.object({
        roomId: z.number().int().positive(),
        quantity: z.number().int().min(0).max(10),
      })
    )
    .min(1),
  serviceSelections: z
    .array(
      z.object({
        serviceId: z.number().int().positive(),
        quantity: z.number().int().min(0).max(50),
      })
    )
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const json = await req.json();
    const parsed = quoteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dữ liệu báo giá không hợp lệ.', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const quote = await calculateBookingQuote(parsed.data);
    return NextResponse.json(quote);
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi tính giá đặt phòng.' },
      { status: 500 }
    );
  }
}
