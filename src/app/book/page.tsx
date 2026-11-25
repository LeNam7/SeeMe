import React from 'react';
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { getAllSiteSettings } from '@/lib/settings';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { RoomBookingWidget } from '@/components/RoomBookingWidget';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Đặt phòng & Đặt nguyên căn',
  description: 'Đặt một hoặc nhiều phòng, ghép nhóm từ 3 phòng trở lên hoặc nguyên căn tại SEEME Homestay Lô Lô Chải.',
};

export default async function MultiRoomBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string; wholeHouse?: string }>;
}) {
  await ensureSeeded();
  const sp = await searchParams;
  const settings = await getAllSiteSettings();

  const allRooms = await db
    .select()
    .from(schema.rooms)
    .where(eq(schema.rooms.isActive, true))
    .orderBy(asc(schema.rooms.sortOrder));

  const services = await db
    .select()
    .from(schema.extraServices)
    .orderBy(asc(schema.extraServices.sortOrder));

  return (
    <>
      <PublicHeader hotline={settings.brand.hotline} hotlineRaw={settings.brand.hotlineRaw} />
      <main className="pt-24 lg:pt-28 pb-24 lg:pb-16">
        <div className="wrap max-w-4xl space-y-6">
          <div className="space-y-2 pb-4 border-b border-black/10">
            <Link href="/" className="text-xs text-[#5c5750] hover:text-[#8d3f28]">
              ← Quay lại trang chủ SEEME Homestay
            </Link>
            <h1 className="font-display text-3xl lg:text-4xl font-normal text-[#221f1c]">
              Đặt phòng trực tuyến & Ghép phòng cho đoàn
            </h1>
            <p className="text-sm text-[#5c5750]">
              Chọn từ 1 phòng lẻ đến 4 phòng nguyên căn ({allRooms.reduce((s, r) => s + r.standardCapacity, 0)}{' '}
              khách tiêu chuẩn). Chính sách cho nhóm từ {settings.policy.groupRoomThreshold} phòng trở lên
              được hiển thị và áp dụng minh bạch trước khi gửi đơn.
            </p>
          </div>

          <RoomBookingWidget
            rooms={allRooms}
            services={services}
            policyConfig={settings.policy}
            initialRoomId={sp.wholeHouse === '1' ? undefined : allRooms[0]?.id}
            initialCheckIn={sp.checkIn}
            initialCheckOut={sp.checkOut}
            initialGuests={sp.guests ? Number(sp.guests) : 2}
            allowMultiRoom={true}
          />
        </div>
      </main>
      <PublicFooter brand={settings.brand} />
    </>
  );
}
