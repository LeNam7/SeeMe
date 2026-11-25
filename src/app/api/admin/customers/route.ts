import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  let customers = await db
    .select()
    .from(schema.customers)
    .orderBy(desc(schema.customers.updatedAt));

  if (q) {
    customers = customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    );
  }
  return NextResponse.json({ customers });
}

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Thiếu ID khách hàng.' }, { status: 400 });
  }

  const [updated] = await db
    .update(schema.customers)
    .set({
      ...(typeof body.internalNotes === 'string' ? { internalNotes: body.internalNotes } : {}),
      ...(Array.isArray(body.tags) ? { tags: body.tags } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.customers.id, id))
    .returning();
  return NextResponse.json({ customer: updated });
}
