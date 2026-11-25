import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';

export async function GET() {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const rules = await db
    .select()
    .from(schema.pricingRules)
    .orderBy(desc(schema.pricingRules.priority), desc(schema.pricingRules.id));
  return NextResponse.json({ rules });
}

const ruleSchema = z.object({
  name: z.string().trim().min(2).max(150),
  ruleType: z.enum(['WEEKDAY', 'WEEKEND', 'SEASONAL', 'HOLIDAY', 'OVERRIDE']),
  roomId: z.number().int().positive().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  priceMode: z.enum(['FIXED', 'PERCENT_MULTIPLIER', 'AMOUNT_DELTA']).default('FIXED'),
  amount: z.number().int(),
  priority: z.number().int().default(10),
  note: z.string().trim().max(300).optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Quy tắc giá không hợp lệ.' }, { status: 400 });
  }

  const [created] = await db
    .insert(schema.pricingRules)
    .values({
      ...parsed.data,
      roomId: parsed.data.roomId ?? null,
      daysOfWeek: parsed.data.daysOfWeek ?? null,
      note: parsed.data.note ?? null,
    })
    .returning();
  return NextResponse.json({ rule: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Thiếu ID quy tắc giá.' }, { status: 400 });
  }
  const [updated] = await db
    .update(schema.pricingRules)
    .set({
      ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
      ...(typeof body.amount === 'number' ? { amount: body.amount } : {}),
      ...(typeof body.name === 'string' ? { name: body.name } : {}),
      ...(typeof body.startDate === 'string' ? { startDate: body.startDate } : {}),
      ...(typeof body.endDate === 'string' ? { endDate: body.endDate } : {}),
    })
    .where(eq(schema.pricingRules.id, id))
    .returning();

  return NextResponse.json({ rule: updated });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Thiếu ID quy tắc.' }, { status: 400 });
  }
  await db.delete(schema.pricingRules).where(eq(schema.pricingRules.id, id));
  return NextResponse.json({ ok: true });
}
