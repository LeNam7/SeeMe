import type { MetadataRoute } from 'next';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await ensureSeeded();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const activeRooms = await db
    .select({ slug: schema.rooms.slug, updatedAt: schema.rooms.updatedAt })
    .from(schema.rooms)
    .where(eq(schema.rooms.isActive, true));

  return [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/book`, lastModified: new Date(), priority: 0.9 },
    ...activeRooms.map((r) => ({
      url: `${baseUrl}/rooms/${r.slug}`,
      lastModified: r.updatedAt,
      priority: 0.9,
    })),
    { url: `${baseUrl}/terms`, lastModified: new Date(), priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), priority: 0.4 },
    { url: `${baseUrl}/credits`, lastModified: new Date(), priority: 0.3 },
  ];
}
