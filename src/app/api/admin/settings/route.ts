import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/db/seed';
import { requireAdminApi } from '@/lib/admin-guard';
import { getAllSiteSettings, updateSiteSetting, type AllSiteSettings } from '@/lib/settings';

export async function GET() {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const settings = await getAllSiteSettings();
  return NextResponse.json({
    settings,
    envStatus: {
      zaloOaConfigured: Boolean(process.env.ZALO_OA_ACCESS_TOKEN),
      paymentWebhookSecretConfigured: Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
      databaseEngine: process.env.DATABASE_URL?.startsWith('postgres') ? 'PostgreSQL' : 'PGlite (Local PostgreSQL)',
    },
  });
}

const patchSettingsSchema = z.object({
  section: z.enum(['brand', 'policy', 'payment', 'workflow', 'zalo']),
  value: z.record(z.unknown()),
});

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const { errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const parsed = patchSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Cấu hình cập nhật không hợp lệ.' }, { status: 400 });
  }

  const current = await getAllSiteSettings();
  const key = parsed.data.section as keyof AllSiteSettings;
  const merged = { ...current[key], ...parsed.data.value } as AllSiteSettings[typeof key];
  await updateSiteSetting(key, merged);
  const updated = await getAllSiteSettings();
  return NextResponse.json({ settings: updated });
}
