import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/db/seed';
import { BookingError, createBookingTransaction } from '@/lib/booking-engine';

const createBookingSchema = z.object({
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
  customerName: z.string().trim().min(2, 'Vui lòng nhập họ và tên').max(120),
  customerPhone: z.string().trim().min(9, 'Số điện thoại tối thiểu 9 chữ số').max(25),
  customerEmail: z.string().trim().email('Email không hợp lệ').optional().or(z.literal('')),
  expectedCheckInTime: z.string().trim().max(40).optional(),
  roomPrepNotes: z.string().trim().max(500).optional(),
  specialNotes: z.string().trim().max(500).optional(),
  consultationTopics: z.array(z.string().trim().max(100)).optional().default([]),
  consultationQuestion: z.string().trim().max(1000).optional(),
  cancellationPolicyAgreed: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const json = await req.json();
    const parsed = createBookingSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || 'Thông tin đặt phòng chưa đầy đủ.',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const result = await createBookingTransaction(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Không thể tạo đơn đặt phòng.' },
      { status: 500 }
    );
  }
}
