import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/db/seed';
import { ADMIN_COOKIE_NAME, createAdminSession, verifyAdminCredentials } from '@/lib/auth';

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' },
        { status: 400 }
      );
    }

    if (!verifyAdminCredentials(parsed.data.username, parsed.data.password)) {
      return NextResponse.json(
        { error: 'Sai tên đăng nhập hoặc mật khẩu quản trị.' },
        { status: 401 }
      );
    }

    const { token, expiresAt } = await createAdminSession(parsed.data.username);
    const res = NextResponse.json({ ok: true, username: parsed.data.username });
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
      secure: process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://'),
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Không thể đăng nhập.' },
      { status: 500 }
    );
  }
}
