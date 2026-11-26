import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { getAvailabilityForRange } from '@/lib/booking-engine';
import { addDays, formatDateVi, formatVnd, getTodayVnDate } from '@/lib/dates';
import { getAllSiteSettings } from '@/lib/settings';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { RoomGalleryLightbox } from '@/components/RoomGalleryLightbox';
import { RoomBookingWidget } from '@/components/RoomBookingWidget';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await ensureSeeded();
  const { slug } = await params;
  const [room] = await db.select().from(schema.rooms).where(eq(schema.rooms.slug, slug));
  if (!room) return { title: 'Không tìm thấy phòng' };
  return {
    title: `${room.name} — Đặt phòng trực tiếp`,
    description: `${room.subtitle}. ${room.description}`,
  };
}

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  await ensureSeeded();
  const { slug } = await params;
  const sp = await searchParams;
  const settings = await getAllSiteSettings();

  const allRooms = await db
    .select()
    .from(schema.rooms)
    .where(eq(schema.rooms.isActive, true))
    .orderBy(asc(schema.rooms.sortOrder));

  const room = allRooms.find((r) => r.slug === slug);
  if (!room) notFound();

  const images = await db
    .select()
    .from(schema.roomImages)
    .where(eq(schema.roomImages.roomId, room.id))
    .orderBy(asc(schema.roomImages.sortOrder));

  const services = await db
    .select()
    .from(schema.extraServices)
    .orderBy(asc(schema.extraServices.sortOrder));

  const today = getTodayVnDate();
  const previewAvail = await getAvailabilityForRange(today, addDays(today, 14), room.id);
  const previewDates = previewAvail.rooms[0]?.dates || [];

  const roomJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HotelRoom',
    name: room.name,
    description: room.description,
    occupancy: {
      '@type': 'QuantitativeValue',
      value: room.standardCapacity,
      maxValue: room.maxCapacity,
    },
    bed: room.bedConfig,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(roomJsonLd) }}
      />
      <PublicHeader hotline={settings.brand.hotline} hotlineRaw={settings.brand.hotlineRaw} />

      <main className="pt-24 lg:pt-28 pb-24 lg:pb-16">
        <div className="wrap space-y-8">
          {/* Breadcrumb */}
          <nav className="text-xs text-[#5c5750] flex items-center gap-2" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[#8d3f28]">
              Trang chủ
            </Link>
            <span>/</span>
            <Link href="/#hang-phong" className="hover:text-[#8d3f28]">
              Hệ thống phòng
            </Link>
            <span>/</span>
            <span className="text-[#221f1c] font-medium">{room.name}</span>
          </nav>

          {/* Header Summary */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-black/10">
            <div className="space-y-2">
              <span className="seeme-badge">Chi tiết hạng phòng SEEME</span>
              <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-[#221f1c]">
                {room.name}
              </h1>
              <p className="text-base text-[#5c5750]">{room.subtitle}</p>
            </div>
            <div className="lg:text-right">
              <span className="text-xs uppercase tracking-wider text-[#5c5750] block">
                {room.baseWeekdayPrice === room.baseWeekendPrice
                  ? 'Giá niêm yết chính thức'
                  : 'Giá ngày thường / cuối tuần'}
              </span>
              <div className="font-display text-2xl font-extrabold text-[#8d3f28]">
                {room.baseWeekdayPrice === room.baseWeekendPrice
                  ? formatVnd(room.baseWeekdayPrice)
                  : `${formatVnd(room.baseWeekdayPrice)} – ${formatVnd(room.baseWeekendPrice)}`}
                <span className="text-sm text-[#5c5750] font-sans font-normal"> / đêm</span>
              </div>
              <span className="text-[11px] text-[#5c5750] block mt-0.5">
                Phụ thu thêm người: +100.000 đ/người/đêm · Lễ/Tết: +200.000 đ/phòng/đêm
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Left column: Gallery + Specs + Amenities + Calendar strip */}
            <div className="lg:col-span-6 space-y-8">
              <RoomGalleryLightbox roomName={room.name} images={images} />

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-[#221f1c]">Không gian & Bố trí</h2>
                <p className="text-[#3c342e] leading-relaxed">{room.description}</p>
                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-lg bg-[#ebe3d5]/60 border border-black/10 text-sm">
                    <span className="text-xs text-[#5c5750] block">Sức chứa</span>
                    <strong>
                      Tiêu chuẩn {room.standardCapacity} khách (tối đa {room.maxCapacity})
                    </strong>
                    {room.maxCapacity > room.standardCapacity && (
                      <span className="text-[11px] text-[#5c5750] block mt-0.5">
                        Thêm người phụ thu 100.000 đ / người / đêm
                      </span>
                    )}
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#ebe3d5]/60 border border-black/10 text-sm">
                    <span className="text-xs text-[#5c5750] block">Diện tích ước lượng</span>
                    <strong>{room.sizeSqm ? `${room.sizeSqm} m²` : 'Rộng rãi tiêu chuẩn'}</strong>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#ebe3d5]/60 border border-black/10 text-sm">
                    <span className="text-xs text-[#5c5750] block">Cấu hình giường</span>
                    <strong>{room.bedConfig}</strong>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#ebe3d5]/60 border border-black/10 text-sm">
                    <span className="text-xs text-[#5c5750] block">Phòng tắm & Hướng nhìn</span>
                    <strong>
                      {room.bathroomType} · {room.viewType}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-[#221f1c]">
                  Tiện nghi đầy đủ trong phòng
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-[#3c342e]">
                  {room.amenities.map((am) => (
                    <li
                      key={am}
                      className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-black/10"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8d3f28] shrink-0" />
                      <span>{am}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Real-time 14-day Availability Calendar Preview */}
              <section className="space-y-3 bg-white border border-black/15 rounded-xl p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-xl text-[#221f1c]">
                    Lịch phòng thực tế 14 đêm tới
                  </h2>
                  <span className="text-xs text-[#5c5750]">Từ CSDL homestay</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {previewDates.map((d) => {
                    const isOpen = d.remainingUnits > 0;
                    return (
                      <div
                        key={d.date}
                        className={`p-2 rounded border text-center text-xs ${
                          isOpen
                            ? 'bg-[#faf7f1] border-emerald-700/25'
                            : 'bg-neutral-100 border-neutral-300 opacity-70'
                        }`}
                      >
                        <div className="font-semibold text-[#221f1c]">
                          {formatDateVi(d.date).slice(0, 5)}
                        </div>
                        <div
                          className={`text-[10px] font-semibold mt-0.5 ${
                            isOpen ? 'text-emerald-800' : 'text-red-700'
                          }`}
                        >
                          {isOpen ? 'Trống' : d.status === 'PENDING' ? 'Đang giữ' : 'Kín'}
                        </div>
                        <div className="text-[11px] text-[#8d3f28] font-medium mt-0.5">
                          {Math.round(d.price / 1000)}k
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-[#5c5750]">
                  Giờ nhận phòng từ <strong>{settings.policy.checkInTime}</strong>, trả phòng trước{' '}
                  <strong>{settings.policy.checkOutTime}</strong>. Không cho phép đặt trùng lịch.
                </p>
              </section>

              {/* Other rooms quick links */}
              <section className="space-y-3 pt-2 border-t border-black/10">
                <h3 className="font-display text-lg text-[#221f1c]">Các phòng khác tại SEEME</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {allRooms
                    .filter((other) => other.id !== room.id)
                    .map((other) => (
                      <Link
                        key={other.id}
                        href={`/rooms/${other.slug}`}
                        className="p-3 rounded-lg bg-[#ebe3d5]/60 hover:bg-[#ebe3d5] border border-black/10 text-xs"
                      >
                        <strong className="block text-sm font-display text-[#221f1c]">
                          {other.name}
                        </strong>
                        <span className="text-[#5c5750]">
                          {other.standardCapacity} người · từ {formatVnd(other.baseWeekdayPrice)}
                        </span>
                      </Link>
                    ))}
                </div>
              </section>
            </div>

            {/* Right column: Live Interactive Booking & Extra Services Calculator */}
            <div className="lg:col-span-6">
              <RoomBookingWidget
                rooms={allRooms}
                services={services}
                policyConfig={settings.policy}
                initialRoomId={room.id}
                initialCheckIn={sp.checkIn}
                initialCheckOut={sp.checkOut}
                initialGuests={sp.guests ? Number(sp.guests) : room.standardCapacity}
                allowMultiRoom={false}
              />
            </div>
          </div>
        </div>
      </main>

      <PublicFooter brand={settings.brand} />
    </>
  );
}
