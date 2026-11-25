import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, destroyAdminSession } from '@/lib/auth';

export async function POST() {
  await destroyAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE_NAME);
  return res;
}
