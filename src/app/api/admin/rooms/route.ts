import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';

function slugifyVi(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

async function generateUniqueSlug(preferred: string): Promise<string> {
  const base = slugifyVi(preferred) || `phong-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await db
      .select({ id: schema.rooms.id })
      .from(schema.rooms)
      .where(eq(schema.rooms.slug, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

export async function GET() {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const roomRows = await db
    .select()
    .from(schema.rooms)
    .orderBy(asc(schema.rooms.sortOrder), asc(schema.rooms.id));
  const ids = roomRows.map((r) => r.id);

  const [imgs, bookingCounts] = await Promise.all([
    ids.length > 0
      ? db
          .select()
          .from(schema.roomImages)
          .where(inArray(schema.roomImages.roomId, ids))
          .orderBy(asc(schema.roomImages.sortOrder))
      : Promise.resolve([]),
    ids.length > 0
      ? db
          .select({
            roomId: schema.bookingItems.roomId,
            count: sql<number>`count(*)::int`,
          })
          .from(schema.bookingItems)
          .where(inArray(schema.bookingItems.roomId, ids))
          .groupBy(schema.bookingItems.roomId)
      : Promise.resolve([]),
  ]);

  const countMap = new Map(bookingCounts.map((c) => [c.roomId, Number(c.count)]));

  return NextResponse.json({
    rooms: roomRows.map((r) => ({
      ...r,
      bookingCount: countMap.get(r.id) ?? 0,
      images: imgs.filter((im) => im.roomId === r.id),
    })),
  });
}

const createRoomSchema = z.object({
  slug: z.string().trim().max(80).optional().default(''),
  name: z.string().trim().min(2, 'Tên phòng tối thiểu 2 ký tự.').max(120),
  subtitle: z.string().trim().min(2, 'Mô tả ngắn tối thiểu 2 ký tự.').max(200),
  description: z.string().trim().min(10, 'Mô tả chi tiết tối thiểu 10 ký tự.'),
  standardCapacity: z.number().int().min(1, 'Sức chứa tối thiểu 1 khách.').max(20),
  maxCapacity: z.number().int().min(1).max(20).optional(),
  bedConfig: z.string().trim().min(2, 'Vui lòng nhập cấu hình giường.'),
  sizeSqm: z.number().int().min(5).max(300).optional().nullable(),
  bathroomType: z.string().trim().min(2).default('WC khép kín'),
  viewType: z.string().trim().min(2).default('Hướng bản Lô Lô Chải'),
  amenities: z.array(z.string().trim().min(1)).default([]),
  highlights: z.array(z.string().trim().min(1)).default([]),
  baseWeekdayPrice: z.number().int().min(100_000, 'Giá ngày thường tối thiểu 100.000 đ.'),
  baseWeekendPrice: z.number().int().min(100_000, 'Giá cuối tuần tối thiểu 100.000 đ.'),
  totalUnits: z.number().int().min(1).max(20).default(1),
  isPriceConfigured: z.boolean().default(true),
  isActive: z.boolean().default(true),
  images: z
    .array(
      z.object({
        url: z.string().trim().min(1),
        altText: z.string().trim().min(1),
        sourceType: z.string().optional().default('uploaded'),
        creditText: z.string().optional().nullable(),
        isPrimary: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const { errorResponse } = await requireAdminApi();
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Dữ liệu phòng chưa hợp lệ.' },
        { status: 400 }
      );
    }

    const { images, slug: rawSlug, maxCapacity: rawMaxCap, ...rest } = parsed.data;
    const slug = await generateUniqueSlug(rawSlug || rest.name);
    const maxCapacity = Math.max(rest.standardCapacity, rawMaxCap ?? rest.standardCapacity);

    const [{ maxSort }] = await db
      .select({ maxSort: sql<number>`coalesce(max(${schema.rooms.sortOrder}), 0)::int` })
      .from(schema.rooms);

    const [created] = await db
      .insert(schema.rooms)
      .values({
        ...rest,
        slug,
        maxCapacity,
        sortOrder: Number(maxSort) + 1,
      })
      .returning();

    const hasExplicitPrimary = images.some((im) => im.isPrimary);
    for (let i = 0; i < images.length; i++) {
      await db.insert(schema.roomImages).values({
        roomId: created.id,
        url: images[i].url,
        altText: images[i].altText || `Ảnh thực tế ${created.name}`,
        sourceType: images[i].sourceType || 'uploaded',
        creditText: images[i].creditText || null,
        isPrimary: hasExplicitPrimary ? Boolean(images[i].isPrimary) : i === 0,
        sortOrder: i,
      });
    }

    const savedImages = await db
      .select()
      .from(schema.roomImages)
      .where(eq(schema.roomImages.roomId, created.id))
      .orderBy(asc(schema.roomImages.sortOrder));

    revalidatePath('/');
    revalidatePath('/book');
    revalidatePath(`/rooms/${created.slug}`);

    return NextResponse.json(
      { room: { ...created, bookingCount: 0, images: savedImages } },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Không thể tạo phòng mới.' },
      { status: 500 }
    );
  }
}
