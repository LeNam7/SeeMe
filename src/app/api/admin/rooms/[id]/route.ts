import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
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

const patchRoomSchema = z.object({
  slug: z.string().trim().min(2).max(80).optional(),
  name: z.string().trim().min(2, 'Tên phòng tối thiểu 2 ký tự.').max(120).optional(),
  subtitle: z.string().trim().min(2, 'Mô tả ngắn tối thiểu 2 ký tự.').max(200).optional(),
  description: z.string().trim().min(10, 'Mô tả chi tiết tối thiểu 10 ký tự.').optional(),
  standardCapacity: z.number().int().min(1).max(20).optional(),
  maxCapacity: z.number().int().min(1).max(20).optional(),
  bedConfig: z.string().trim().min(2).optional(),
  sizeSqm: z.number().int().min(5).max(300).nullable().optional(),
  bathroomType: z.string().trim().min(2).optional(),
  viewType: z.string().trim().min(2).optional(),
  amenities: z.array(z.string().trim().min(1)).optional(),
  highlights: z.array(z.string().trim().min(1)).optional(),
  baseWeekdayPrice: z.number().int().min(100_000, 'Giá ngày thường tối thiểu 100.000 đ.').optional(),
  baseWeekendPrice: z.number().int().min(100_000, 'Giá cuối tuần tối thiểu 100.000 đ.').optional(),
  totalUnits: z.number().int().min(1).max(20).optional(),
  isPriceConfigured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
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
  try {
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
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Thông tin cập nhật phòng không hợp lệ.' },
        { status: 400 }
      );
    }

    const { images, slug: rawSlug, ...fields } = parsed.data;
    const updatePayload: Record<string, unknown> = {
      ...fields,
      updatedAt: new Date(),
    };

    if (typeof rawSlug === 'string' && rawSlug.length > 0) {
      const normalized = slugifyVi(rawSlug);
      if (normalized.length < 2) {
        return NextResponse.json({ error: 'Đường dẫn URL (slug) không hợp lệ.' }, { status: 400 });
      }
      const conflict = await db
        .select({ id: schema.rooms.id })
        .from(schema.rooms)
        .where(and(eq(schema.rooms.slug, normalized), ne(schema.rooms.id, roomId)))
        .limit(1);
      if (conflict.length > 0) {
        return NextResponse.json(
          { error: `Đường dẫn "/rooms/${normalized}" đã được dùng cho phòng khác.` },
          { status: 409 }
        );
      }
      updatePayload.slug = normalized;
    }

    if (
      typeof fields.standardCapacity === 'number' &&
      typeof fields.maxCapacity === 'number' &&
      fields.maxCapacity < fields.standardCapacity
    ) {
      updatePayload.maxCapacity = fields.standardCapacity;
    }

    const [updated] = await db
      .update(schema.rooms)
      .set(updatePayload)
      .where(eq(schema.rooms.id, roomId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Không tìm thấy phòng.' }, { status: 404 });
    }

    if (images) {
      await db.delete(schema.roomImages).where(eq(schema.roomImages.roomId, roomId));
      const hasExplicitPrimary = images.some((im) => im.isPrimary);
      for (let i = 0; i < images.length; i++) {
        await db.insert(schema.roomImages).values({
          roomId,
          url: images[i].url,
          altText: images[i].altText,
          sourceType: images[i].sourceType || 'uploaded',
          creditText: images[i].creditText || null,
          isPrimary: hasExplicitPrimary ? Boolean(images[i].isPrimary) : i === 0,
          sortOrder: i,
        });
      }
    }

    const [savedImages, countRow] = await Promise.all([
      db
        .select()
        .from(schema.roomImages)
        .where(eq(schema.roomImages.roomId, roomId))
        .orderBy(asc(schema.roomImages.sortOrder)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.bookingItems)
        .where(eq(schema.bookingItems.roomId, roomId)),
    ]);

    revalidatePath('/');
    revalidatePath('/book');
    revalidatePath(`/rooms/${updated.slug}`);

    return NextResponse.json({
      room: {
        ...updated,
        bookingCount: Number(countRow[0]?.count ?? 0),
        images: savedImages,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi cập nhật thông tin phòng.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { errorResponse } = await requireAdminApi();
    if (errorResponse) return errorResponse;

    const { id } = await context.params;
    const roomId = Number(id);
    if (!Number.isInteger(roomId) || roomId <= 0) {
      return NextResponse.json({ error: 'ID phòng không hợp lệ.' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.id, roomId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy phòng.' }, { status: 404 });
    }

    const [{ count: bookingCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.bookingItems)
      .where(eq(schema.bookingItems.roomId, roomId));

    const archiveFallback = req.nextUrl.searchParams.get('archive') === '1';

    if (Number(bookingCount) > 0) {
      if (archiveFallback) {
        const [archived] = await db
          .update(schema.rooms)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(schema.rooms.id, roomId))
          .returning();

        revalidatePath('/');
        revalidatePath('/book');
        revalidatePath(`/rooms/${existing.slug}`);

        return NextResponse.json({
          ok: true,
          mode: 'archived',
          room: archived,
          message: `Đã chuyển ${existing.name} sang trạng thái Tạm ẩn để bảo toàn ${bookingCount} đơn đặt phòng trong lịch sử.`,
        });
      }

      return NextResponse.json(
        {
          error: `${existing.name} đang gắn với ${bookingCount} đơn đặt phòng trong lịch sử nên không thể xóa vĩnh viễn. Bạn có thể chuyển phòng sang Tạm ẩn để ngừng nhận khách.`,
          hasBookings: true,
          bookingCount: Number(bookingCount),
        },
        { status: 409 }
      );
    }

    // No booking items reference this room -> safe hard delete (cascades roomImages, availabilityBlocks, pricingRules)
    await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));

    revalidatePath('/');
    revalidatePath('/book');
    revalidatePath(`/rooms/${existing.slug}`);

    return NextResponse.json({
      ok: true,
      mode: 'deleted',
      deletedId: roomId,
      message: `Đã xóa vĩnh viễn ${existing.name} khỏi hệ thống.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Không thể xóa phòng.' },
      { status: 500 }
    );
  }
}
