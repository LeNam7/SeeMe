import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/db/seed';
import { verifyWebhookSignature } from '@/lib/auth';
import { BookingError, processPaymentWebhookEvent } from '@/lib/booking-engine';

const webhookSchema = z.object({
  transactionRef: z.string().trim().min(3).max(120),
  bookingCode: z.string().trim().min(4).max(40),
  amount: z.number().finite().positive(),
  transferContent: z.string().trim().max(240).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const rawBody = await req.text();
    const sigHeader = req.headers.get('x-seemee-signature');

    if (!verifyWebhookSignature(rawBody, sigHeader)) {
      return NextResponse.json(
        { error: 'Chữ ký webhook thanh toán (x-seemee-signature) không hợp lệ.' },
        { status: 401 }
      );
    }

    const parsedJson = JSON.parse(rawBody || '{}') as Record<string, unknown>;
    const parsed = webhookSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dữ liệu webhook không đúng định dạng.', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const outcome = await processPaymentWebhookEvent({
      transactionRef: parsed.data.transactionRef,
      bookingCode: parsed.data.bookingCode.toUpperCase(),
      amount: parsed.data.amount,
      transferContent: parsed.data.transferContent,
      rawPayload: parsedJson,
    });

    if (outcome.status === 'AMOUNT_MISMATCH') {
      return NextResponse.json(outcome, { status: 422 });
    }

    return NextResponse.json(outcome);
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi xử lý webhook thanh toán.' },
      { status: 500 }
    );
  }
}
