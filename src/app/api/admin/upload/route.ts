import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { requireAdminApi } from '@/lib/admin-guard';

const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdminApi();
    if (errorResponse) return errorResponse;

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Thiếu tệp ảnh tải lên.' }, { status: 400 });
    }

    const ext = ALLOWED_EXT[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Dung lượng ảnh tối đa 5 MB.' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const safeBase = file.name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .slice(0, 40);
    const filename = `${Date.now()}-${safeBase || 'photo'}${ext}`;
    const dest = path.join(uploadsDir, filename);

    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(dest, bytes);

    return NextResponse.json({
      url: `/uploads/${filename}`,
      filename,
      size: file.size,
      sourceType: 'uploaded',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi tải ảnh lên.' },
      { status: 500 }
    );
  }
}
