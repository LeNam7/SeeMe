import React from 'react';
import { ensureSeeded } from '@/db/seed';
import { getAdminSession } from '@/lib/auth';
import { AdminConsole } from '@/components/AdminConsole';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Hệ thống Quản trị SEEME Homestay',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await ensureSeeded();
  const session = await getAdminSession();
  return <AdminConsole initialSession={session} />;
}
