import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';
import { BookingError, performAdminBookingAction } from '@/lib/booking-engine';

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'CANCEL', 'RECONCILE_PAID', 'SAVE_NOTE', 'FORCE_EXPIRE']),
  reason: z.string().trim().max(500).optional(),
  bankRef: z.string().trim().max(120).optional(),
  adminNotes: z.string().trim().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { session, errorResponse } = await requireAdminApi();
    if (errorResponse || !session) return errorResponse!;

    const { id } = await context.params;
    const bookingId = Number(id);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return NextResponse.json({ error: 'ID đơn không hợp lệ.' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dữ liệu thao tác không hợp lệ.' }, { status: 400 });
    }

    const updated = await performAdminBookingAction({
      bookingId,
      action: parsed.data.action,
      adminUsername: session.username,
      reason: parsed.data.reason,
      bankRef: parsed.data.bankRef,
      adminNotes: parsed.data.adminNotes,
    });

    return NextResponse.json({ ok: true, booking: updated });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi cập nhật đơn.' },
      { status: 500 }
    );
  }
}
