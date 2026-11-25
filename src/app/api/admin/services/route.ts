import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';

export async function GET() {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const services = await db
    .select()
    .from(schema.extraServices)
    .orderBy(asc(schema.extraServices.sortOrder), asc(schema.extraServices.id));
  return NextResponse.json({ services });
}

const createServiceSchema = z.object({
  slug: z.string().trim().min(2).max(80).optional(),
  name: z.string().trim().min(2).max(120),
  category: z.enum(['FOOD', 'EXPERIENCE', 'TRANSPORT', 'ADDON']),
  description: z.string().trim().min(4).max(400),
  price: z.number().int().min(0).max(50_000_000),
  unit: z.string().trim().min(1).max(60),
  imageUrl: z.string().trim().min(1).default('/assets/img/photo-m61777177.webp'),
  imageAlt: z.string().trim().min(1).default('Dịch vụ tại SEEME Homestay'),
  sourceType: z.string().default('uploaded'),
  isAvailable: z.boolean().default(true),
  isPriceConfigured: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const parsed = createServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dữ liệu dịch vụ không hợp lệ.' }, { status: 400 });
  }

  const slug =
    parsed.data.slug ||
    parsed.data.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
      '-' +
      Date.now().toString().slice(-4);

  const [created] = await db
    .insert(schema.extraServices)
    .values({
      ...parsed.data,
      slug,
      sortOrder: 50,
    })
    .returning();
  return NextResponse.json({ service: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Thiếu ID dịch vụ.' }, { status: 400 });
  }

  const [updated] = await db
    .update(schema.extraServices)
    .set({
      ...(typeof body.name === 'string' ? { name: body.name } : {}),
      ...(typeof body.description === 'string' ? { description: body.description } : {}),
      ...(typeof body.price === 'number' ? { price: body.price, isPriceConfigured: true } : {}),
      ...(typeof body.unit === 'string' ? { unit: body.unit } : {}),
      ...(typeof body.imageUrl === 'string' ? { imageUrl: body.imageUrl } : {}),
      ...(typeof body.isAvailable === 'boolean' ? { isAvailable: body.isAvailable } : {}),
    })
    .where(eq(schema.extraServices.id, id))
    .returning();
  return NextResponse.json({ service: updated });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Thiếu ID dịch vụ.' }, { status: 400 });
  }
  await db.delete(schema.extraServices).where(eq(schema.extraServices.id, id));
  return NextResponse.json({ ok: true });
}
