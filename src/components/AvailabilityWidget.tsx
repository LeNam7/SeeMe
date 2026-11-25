'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { addDays, formatDateVi, formatVnd, getTodayVnDate } from '@/lib/dates';
import { GuestStepperInput } from '@/components/GuestStepperInput';
import { DateRangePicker } from '@/components/DateRangePicker';

export interface HomeRoomCardItem {
  id: number;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  standardCapacity: number;
  maxCapacity: number;
  bathroomType: string;
  bedConfig: string;
  amenities: string[];
  baseWeekdayPrice: number;
  primaryImageUrl: string;
  primaryImageAlt: string;
  imgAttrs: {
    src: string;
    srcSet?: string;
    sizes?: string;
    width?: number;
    height?: number;
  };
}

interface AvailabilityRoom {
  roomId: number;
  slug: string;
  name: string;
  availableUnitsForStay: number;
  dates: { date: string; price: number; status: string }[];
}

export function AvailabilityWidget({ rooms }: { rooms: HomeRoomCardItem[] }) {
  const today = getTodayVnDate();
  const [checkIn, setCheckIn] = useState(addDays(today, 2));
  const [checkOut, setCheckOut] = useState(addDays(today, 3));
  const [guests, setGuests] = useState(2);
  const [roomsNeeded, setRoomsNeeded] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    nightsCount: number;
    rooms: AvailabilityRoom[];
  } | null>(null);

  async function checkAvailability(ci: string, co: string) {
    if (!ci || !co || co <= ci) {
      setError('Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm.');
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/availability?checkIn=${ci}&checkOut=${co}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Không thể kiểm tra lịch phòng.');
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setError('Kết nối kiểm tra lịch thất bại, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void checkAvailability(checkIn, checkOut);
  }, [checkIn, checkOut]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void checkAvailability(checkIn, checkOut);
  }

  const availMap = new Map(result?.rooms.map((r) => [r.roomId, r]));
  const totalAvailableRooms = result
    ? result.rooms.filter((r) => r.availableUnitsForStay > 0).length
    : null;

  return (
    <div className="space-y-8">
      {/* Compact Live Date & Guest Filter Bar directly inside Accommodation section */}
      <div
        id="dat-phong"
        className="scroll-mt-24 bg-white border border-black/15 rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5"
      >
        <form
          onSubmit={handleSubmit}
          className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-end"
        >
          <div className="flex-1 min-w-0">
            <label
              htmlFor="av-dates"
              className="block text-xs font-semibold uppercase tracking-wider text-[#47423c] mb-1.5"
            >
              Ngày lưu trú
            </label>
            <DateRangePicker
              id="av-dates"
              checkIn={checkIn}
              checkOut={checkOut}
              minDate={today}
              onChange={(nextIn, nextOut) => {
                setCheckIn(nextIn);
                setCheckOut(nextOut);
              }}
            />
          </div>

          <div className="w-full lg:w-44 shrink-0">
            <label
              htmlFor="av-guests"
              className="block text-xs font-semibold uppercase tracking-wider text-[#47423c] mb-1.5"
            >
              Số khách
            </label>
            <GuestStepperInput id="av-guests" value={guests} onChange={setGuests} min={1} max={30} />
          </div>

          <div className="w-full lg:w-48 shrink-0">
            <label
              htmlFor="av-rooms"
              className="block text-xs font-semibold uppercase tracking-wider text-[#47423c] mb-1.5"
            >
              Số phòng dự kiến
            </label>
            <select
              id="av-rooms"
              value={roomsNeeded}
              onChange={(e) => setRoomsNeeded(Number(e.target.value))}
              className="seeme-select h-[44px]"
            >
              <option value={1}>1 phòng</option>
              <option value={2}>2 phòng</option>
              <option value={3}>3 phòng (nhóm)</option>
              <option value={4}>4 phòng (nguyên căn)</option>
            </select>
          </div>

          <div className="w-full lg:w-48 shrink-0">
            <button
              type="submit"
              disabled={loading}
              className="btn btn--primary w-full justify-center h-[44px] flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              {loading ? 'Đang kiểm tra...' : 'Xem phòng trống'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && !error && (
          <div className="pt-3 border-t border-black/10 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#221f1c]">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              {result.nightsCount === 1
                ? `Lịch thực tế ngày ${formatDateVi(checkIn)} (1 đêm)`
                : `Lịch thực tế ${formatDateVi(checkIn).slice(0, 5)} → ${formatDateVi(checkOut).slice(0, 5)} (${result.nightsCount} đêm)`}
              : còn{' '}
              <strong>
                {totalAvailableRooms}/{rooms.length} hạng phòng trống
              </strong>
            </span>
            <Link
              href={`/book?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}&wholeHouse=${
                roomsNeeded === 4 ? '1' : '0'
              }`}
              className="text-xs font-semibold text-[#8d3f28] hover:underline inline-flex items-center gap-1"
            >
              {roomsNeeded === 4
                ? 'Đặt trọn 4 phòng (Nguyên căn)'
                : roomsNeeded >= 2
                  ? `Ghép ${roomsNeeded} phòng trong 1 đơn`
                  : 'Đặt nhiều phòng / đặt nguyên căn'}{' '}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Main 4 Room Showcase Cards with Live Availability Status next to Price */}
      <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
        {rooms.map((room) => {
          const av = availMap.get(room.id);
          const isAvail = av ? av.availableUnitsForStay > 0 : true;
          const hasLiveStatus = Boolean(result && av && !error);
          const firstPrice = av?.dates[0]?.price ?? room.baseWeekdayPrice;
          const totalStayPrice =
            av?.dates.reduce((s, d) => s + d.price, 0) ??
            firstPrice * (result?.nightsCount ?? 1);

          const bookingHref = isAvail
            ? `/rooms/${room.slug}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`
            : `/rooms/${room.slug}`;

          return (
            <article
              key={room.id}
              className={`seeme-card flex flex-col justify-between transition ${
                hasLiveStatus && !isAvail ? 'opacity-80' : ''
              }`}
            >
              <div>
                <Link href={bookingHref} className="seeme-img-wrap aspect-[16/10] block">
                  <img
                    src={room.imgAttrs.src}
                    srcSet={room.imgAttrs.srcSet}
                    sizes={room.imgAttrs.sizes}
                    width={room.imgAttrs.width}
                    height={room.imgAttrs.height}
                    alt={room.primaryImageAlt}
                    loading="lazy"
                    decoding="async"
                  />
                </Link>

                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-xl text-[#221f1c] font-bold">
                        <Link href={bookingHref} className="hover:text-[#8d3f28]">
                          {room.name}
                        </Link>
                      </h3>
                      <p className="text-xs font-medium text-[#8d3f28] mt-1">{room.subtitle}</p>
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                      {hasLiveStatus && (
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${
                            isAvail
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-neutral-100 text-neutral-600 border-black/15'
                          }`}
                        >
                          {isAvail ? 'Còn trống' : 'Kín lịch'}
                        </span>
                      )}
                      <div className="text-right">
                        <span className="text-[11px] uppercase tracking-wider text-[#5c5750] block">
                          Từ
                        </span>
                        <span className="font-semibold text-base text-[#221f1c] tabular-nums">
                          {formatVnd(room.baseWeekdayPrice)}
                        </span>
                        <span className="text-xs text-[#5c5750] block">/đêm</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-[#3c342e] leading-relaxed">{room.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs text-[#3c342e] pt-2 border-t border-black/10">
                    <div>
                      <strong className="text-[#221f1c]">Sức chứa:</strong> Tiêu chuẩn{' '}
                      {room.standardCapacity} người
                    </div>
                    <div>
                      <strong className="text-[#221f1c]">Phòng tắm:</strong> {room.bathroomType}
                    </div>
                    <div className="col-span-2">
                      <strong className="text-[#221f1c]">Giường:</strong> {room.bedConfig}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {room.amenities.slice(0, 6).map((am) => (
                      <span
                        key={am}
                        className="text-[11px] px-2 py-0.5 rounded bg-[#ebe3d5] text-[#3c342e]"
                      >
                        {am}
                      </span>
                    ))}
                    {room.amenities.length > 6 && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-[#faf7f1] text-[#5c5750]">
                        +{room.amenities.length - 6} tiện nghi khác
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-2 space-y-2.5">
                {hasLiveStatus && result && (
                  <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-[#faf7f1] border border-black/10">
                    <span className="text-[#5c5750]">
                      {isAvail
                        ? result.nightsCount === 1
                          ? `Giá ngày ${formatDateVi(checkIn)} (1 đêm)`
                          : `Tổng ${result.nightsCount} đêm (${formatDateVi(checkIn).slice(0, 5)} → ${formatDateVi(checkOut).slice(0, 5)})`
                        : result.nightsCount === 1
                          ? `Đã kín lịch ngày ${formatDateVi(checkIn)}`
                          : `Đã kín lịch ${formatDateVi(checkIn).slice(0, 5)} → ${formatDateVi(checkOut).slice(0, 5)}`}
                    </span>
                    <strong className="text-sm text-[#8d3f28] tabular-nums">
                      {formatVnd(totalStayPrice)}
                    </strong>
                  </div>
                )}

                <Link
                  href={bookingHref}
                  className={`btn w-full text-center justify-center ${
                    hasLiveStatus && !isAvail ? 'btn--secondary' : 'btn--primary'
                  }`}
                >
                  {hasLiveStatus && !isAvail
                    ? `Kín ngày này · Xem lịch ${room.name}`
                    : `Xem chi tiết & Đặt ${room.name}`}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
