import { NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { count } from 'drizzle-orm';

export async function GET() {
  try {
    await ensureSeeded();
    const [{ value: roomsCount }] = await db.select({ value: count() }).from(schema.rooms);
    const engine = process.env.DATABASE_URL?.startsWith('postgres') ? 'postgres' : 'pglite';
    return NextResponse.json({
      ok: true,
      engine,
      roomsCount: Number(roomsCount),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Database healthcheck failed' },
      { status: 500 }
    );
  }
}
