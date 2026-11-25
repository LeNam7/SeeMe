import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';

const patchRoomSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  subtitle: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().min(10).optional(),
  standardCapacity: z.number().int().min(1).max(20).optional(),
  maxCapacity: z.number().int().min(1).max(20).optional(),
  bedConfig: z.string().trim().min(2).optional(),
  sizeSqm: z.number().int().min(5).max(300).nullable().optional(),
  bathroomType: z.string().trim().min(2).optional(),
  viewType: z.string().trim().min(2).optional(),
  amenities: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
  baseWeekdayPrice: z.number().int().min(100_000).optional(),
  baseWeekendPrice: z.number().int().min(100_000).optional(),
  totalUnits: z.number().int().min(1).max(20).optional(),
  isPriceConfigured: z.boolean().optional(),
  isActive: z.boolean().optional(),
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
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const roomId = Number(id);
  if (!Number.isInteger(roomId) || roomId <= 0) {
    return NextResponse.json({ error: 'ID phòng không hợp lệ.' }, { status: 400 });
  }

  const body = await req.json();
  const parsed = patchRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Thông tin cập nhật phòng không hợp lệ.' }, { status: 400 });
  }

  const { images, ...fields } = parsed.data;
  const [updated] = await db
    .update(schema.rooms)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(schema.rooms.id, roomId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Không tìm thấy phòng.' }, { status: 404 });
  }

  if (images) {
    await db.delete(schema.roomImages).where(eq(schema.roomImages.roomId, roomId));
    for (let i = 0; i < images.length; i++) {
      await db.insert(schema.roomImages).values({
        roomId,
        url: images[i].url,
        altText: images[i].altText,
        sourceType: images[i].sourceType || 'uploaded',
        creditText: images[i].creditText || null,
        isPrimary: images[i].isPrimary || i === 0,
        sortOrder: i,
      });
    }
  }

  const savedImages = await db
    .select()
    .from(schema.roomImages)
    .where(eq(schema.roomImages.roomId, roomId));

  return NextResponse.json({ room: { ...updated, images: savedImages } });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const roomId = Number(id);
  const [updated] = await db
    .update(schema.rooms)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(schema.rooms.id, roomId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Không tìm thấy phòng.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, room: updated });
}
