'use client';

import React from 'react';
import Link from 'next/link';
import { Users, BedDouble, Bath, Maximize2 } from 'lucide-react';
import { formatVnd } from '@/lib/dates';

export interface HomeRoomCardItem {
  id: number;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  standardCapacity: number;
  maxCapacity: number;
  sizeSqm?: number | null;
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

export function AvailabilityWidget({ rooms }: { rooms: HomeRoomCardItem[] }) {
  return (
    <div id="dat-phong" className="scroll-mt-24">
      {/* Main 4 Room Showcase Cards */}
      <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
        {rooms.map((room) => {
          const bookingHref = `/rooms/${room.slug}`;

          return (
            <article
              key={room.id}
              className="seeme-card flex flex-col justify-between transition"
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

                <div className="p-6 space-y-3.5">
                  {/* Row 1: Room Name + Price */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl text-[#221f1c] font-extrabold leading-snug min-w-0">
                      <Link href={bookingHref} className="hover:text-[#8d3f28] transition-colors">
                        {room.name}
                      </Link>
                    </h3>

                    <div className="text-right shrink-0 leading-tight">
                      <span className="font-extrabold text-lg text-[#8d3f28] tabular-nums">
                        {formatVnd(room.baseWeekdayPrice)}
                      </span>
                      <span className="text-xs text-[#5c5750] block mt-0.5">từ / đêm</span>
                    </div>
                  </div>

                  {/* Row 2: Scannable Icon Facts (Capacity · Bathroom · Area + Bed) */}
                  <div className="space-y-1.5 text-xs text-[#3c342e] pt-2.5 border-t border-black/10">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-[#221f1c]">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#8d3f28] shrink-0" />
                        {room.standardCapacity} khách
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Bath className="w-3.5 h-3.5 text-[#8d3f28] shrink-0" />
                        {room.bathroomType}
                      </span>
                      {room.sizeSqm && (
                        <span className="inline-flex items-center gap-1.5">
                          <Maximize2 className="w-3.5 h-3.5 text-[#8d3f28] shrink-0" />
                          {room.sizeSqm} m²
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-1.5 text-[#47423c]">
                      <BedDouble className="w-3.5 h-3.5 text-[#8d3f28] shrink-0 mt-0.5" />
                      <span>{room.bedConfig}</span>
                    </div>
                  </div>

                  {/* Row 3: Concise 2-line editorial summary */}
                  <p className="text-sm text-[#47423c] leading-relaxed line-clamp-2">
                    {room.description}
                  </p>

                  {/* Row 4: Quiet 3-feature highlights */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5c5750] pt-0.5">
                    {room.amenities.slice(0, 3).map((am) => (
                      <span key={am} className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#8d3f28]/60 shrink-0" />
                        {am}
                      </span>
                    ))}
                    {room.amenities.length > 3 && (
                      <span className="text-[#8d3f28] font-semibold">
                        +{room.amenities.length - 3} tiện nghi
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-2">
                <Link
                  href={bookingHref}
                  className="btn btn--primary w-full text-center justify-center"
                >
                  Xem chi tiết & Đặt {room.name}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
