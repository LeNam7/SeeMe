import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';
import { getAvailabilityForRange } from '@/lib/booking-engine';
import { addDays, getTodayVnDate, isValidIsoDate } from '@/lib/dates';

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded();
    const { errorResponse } = await requireAdminApi();
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const today = getTodayVnDate();
    const start = searchParams.get('start') || today;
    const end = searchParams.get('end') || addDays(start, 14);
    const roomIdParam = searchParams.get('roomId');
    const roomId = roomIdParam ? Number(roomIdParam) : undefined;

    if (!isValidIsoDate(start) || !isValidIsoDate(end) || end <= start) {
      return NextResponse.json({ error: 'Khoảng ngày lịch không hợp lệ.' }, { status: 400 });
    }

    const matrix = await getAvailabilityForRange(start, end, roomId);
    const overrides = await db
      .select()
      .from(schema.pricingRules)
      .where(eq(schema.pricingRules.ruleType, 'OVERRIDE'));

    return NextResponse.json({ ...matrix, overrides });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Không thể tải Matrix Calendar.' },
      { status: 500 }
    );
  }
}

const calendarActionSchema = z.object({
  action: z.enum(['BLOCK_DATE', 'UNBLOCK_DATE', 'PRICE_OVERRIDE', 'CLEAR_PRICE_OVERRIDE']),
  roomId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(40).optional(),
  note: z.string().trim().max(240).optional(),
  overridePrice: z.number().int().min(0).max(100_000_000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const { errorResponse } = await requireAdminApi();
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const parsed = calendarActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dữ liệu cập nhật lịch không hợp lệ.' }, { status: 400 });
    }

    const { action, roomId, date, reason, note, overridePrice } = parsed.data;

    if (action === 'BLOCK_DATE') {
      await db
        .insert(schema.availabilityBlocks)
        .values({
          roomId,
          blockDate: date,
          unitsBlocked: 1,
          reason: reason || 'OWNER_BLOCK',
          note: note || 'Chủ nhà khóa phòng thủ công',
        })
        .onConflictDoUpdate({
          target: [schema.availabilityBlocks.roomId, schema.availabilityBlocks.blockDate],
          set: {
            unitsBlocked: 1,
            reason: reason || 'OWNER_BLOCK',
            note: note || 'Chủ nhà khóa phòng thủ công',
          },
        });
      return NextResponse.json({ ok: true, action, roomId, date });
    }

    if (action === 'UNBLOCK_DATE') {
      await db
        .delete(schema.availabilityBlocks)
        .where(
          and(
            eq(schema.availabilityBlocks.roomId, roomId),
            eq(schema.availabilityBlocks.blockDate, date)
          )
        );
      return NextResponse.json({ ok: true, action, roomId, date });
    }

    if (action === 'PRICE_OVERRIDE') {
      if (typeof overridePrice !== 'number') {
        return NextResponse.json({ error: 'Vui lòng nhập mức giá ghi đè.' }, { status: 400 });
      }
      // Remove previous override for same room + single day cleanly before inserting
      await db
        .delete(schema.pricingRules)
        .where(
          and(
            eq(schema.pricingRules.ruleType, 'OVERRIDE'),
            eq(schema.pricingRules.roomId, roomId),
            eq(schema.pricingRules.startDate, date),
            eq(schema.pricingRules.endDate, date)
          )
        );

      const [created] = await db
        .insert(schema.pricingRules)
        .values({
          name: `Giá chỉnh tay ngày ${date}`,
          ruleType: 'OVERRIDE',
          roomId,
          startDate: date,
          endDate: date,
          daysOfWeek: null,
          priceMode: 'FIXED',
          amount: overridePrice,
          priority: 999,
          note: note || 'Điều chỉnh giá trực tiếp từ Matrix Calendar',
          isActive: true,
        })
        .returning();
      return NextResponse.json({ ok: true, action, rule: created });
    }

    if (action === 'CLEAR_PRICE_OVERRIDE') {
      await db
        .delete(schema.pricingRules)
        .where(
          and(
            eq(schema.pricingRules.ruleType, 'OVERRIDE'),
            eq(schema.pricingRules.roomId, roomId),
            eq(schema.pricingRules.startDate, date),
            eq(schema.pricingRules.endDate, date)
          )
        );
      return NextResponse.json({ ok: true, action, roomId, date });
    }

    return NextResponse.json({ error: 'Thao tác không hỗ trợ.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi cập nhật Matrix Calendar.' },
      { status: 500 }
    );
  }
}
