import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { asc, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';

export async function GET() {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const roomRows = await db.select().from(schema.rooms).orderBy(asc(schema.rooms.sortOrder));
  const ids = roomRows.map((r) => r.id);
  const imgs =
    ids.length > 0
      ? await db
          .select()
          .from(schema.roomImages)
          .where(inArray(schema.roomImages.roomId, ids))
          .orderBy(asc(schema.roomImages.sortOrder))
      : [];

  return NextResponse.json({
    rooms: roomRows.map((r) => ({
      ...r,
      images: imgs.filter((im) => im.roomId === r.id),
    })),
  });
}

const createRoomSchema = z.object({
  slug: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().min(2).max(200),
  description: z.string().trim().min(10),
  standardCapacity: z.number().int().min(1).max(20),
  maxCapacity: z.number().int().min(1).max(20),
  bedConfig: z.string().trim().min(2),
  sizeSqm: z.number().int().min(5).max(300).optional().nullable(),
  bathroomType: z.string().trim().min(2),
  viewType: z.string().trim().min(2),
  amenities: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
  baseWeekdayPrice: z.number().int().min(100_000),
  baseWeekendPrice: z.number().int().min(100_000),
  totalUnits: z.number().int().min(1).max(20).default(1),
  isPriceConfigured: z.boolean().default(true),
  isActive: z.boolean().default(true),
  images: z
    .array(
      z.object({
        url: z.string().trim().min(1),
        altText: z.string().trim().min(1),
        sourceType: z.string().optional().default('uploaded'),
        isPrimary: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
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

  const { images, ...fields } = parsed.data;
  const [created] = await db.insert(schema.rooms).values(fields).returning();

  for (let i = 0; i < images.length; i++) {
    await db.insert(schema.roomImages).values({
      roomId: created.id,
      url: images[i].url,
      altText: images[i].altText,
      sourceType: images[i].sourceType || 'uploaded',
      isPrimary: images[i].isPrimary || i === 0,
      sortOrder: i,
    });
  }

  return NextResponse.json({ room: created }, { status: 201 });
}
