import { NextResponse } from 'next/server';
import { getAdminSession } from './auth';

export async function requireAdminApi() {
  const session = await getAdminSession();
  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Yêu cầu đăng nhập quản trị viên.' },
        { status: 401 }
      ),
    };
  }
  return { session, errorResponse: null };
}
