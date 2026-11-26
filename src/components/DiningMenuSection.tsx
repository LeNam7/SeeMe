'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, UtensilsCrossed, Wine, Expand, X, FileText } from 'lucide-react';
import { formatVnd } from '@/lib/dates';

export interface DiningServiceItem {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  unit: string;
  imageUrl: string;
  imageAlt: string;
}

type MenuGroupId = 'LAU' | 'BBQ' | 'SIDE';

const MENU_TABS: { id: MenuGroupId; label: string; note?: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'LAU', label: 'Lẩu nóng', note: 'Nồi tối thiểu 2 người', icon: Flame },
  { id: 'BBQ', label: 'Nướng BBQ', note: 'Chuẩn bị than hồng tại sân', icon: UtensilsCrossed },
  { id: 'SIDE', label: 'Món phụ & Đồ uống', note: 'Đặc sản địa phương Hà Giang', icon: Wine },
];

const FOOD_PHOTOS = [
  {
    src: '/assets/img/seeme/food-lau-ga-den.jpg',
    alt: 'Nồi lẩu gà đen bản nóng hổi bên tường trình đất ấm cúng tại SEEME Homestay',
    caption: 'Lẩu gà đen bản & rau tươi cao nguyên',
  },
  {
    src: '/assets/img/seeme/food-bbq-beer.jpg',
    alt: 'Tiệc nướng BBQ than hồng cùng bia Tam giác mạch Đồng Văn buổi tối tại SEEME',
    caption: 'BBQ & Bia Tam giác mạch',
  },
  {
    src: '/assets/img/seeme/food-lau-ban-tra.jpg',
    alt: 'Bàn lẩu tối ấm cúng cùng trà sữa Shan Tuyết và bia tam giác mạch tại SEEME',
    caption: 'Lẩu tối & Trà sữa Shan Tuyết',
  },
  {
    src: '/assets/img/seeme/food-shan-tuyet-bar.jpg',
    alt: 'Quầy trà sữa Shan Tuyết — Si mê vị trà cổ, sản vật Hà Giang ngay tại cổng SEEME Homestay',
    caption: 'Quầy trà sữa Shan Tuyết SEEME',
  },
];

function classifyService(svc: DiningServiceItem): MenuGroupId {
  if (svc.slug.startsWith('lau-')) return 'LAU';
  if (svc.slug.startsWith('bbq-')) return 'BBQ';
  return 'SIDE';
}

export function DiningMenuSection({
  services,
  hotline = '0932.237.796',
}: {
  services: DiningServiceItem[];
  hotline?: string;
}) {
  const [activeTab, setActiveTab] = useState<MenuGroupId>('LAU');
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const grouped: Record<MenuGroupId, DiningServiceItem[]> = {
    LAU: services.filter((s) => classifyService(s) === 'LAU'),
    BBQ: services.filter((s) => classifyService(s) === 'BBQ'),
    SIDE: services.filter((s) => classifyService(s) === 'SIDE'),
  };

  const activeItems = grouped[activeTab];
  const activeTabMeta = MENU_TABS.find((t) => t.id === activeTab) || MENU_TABS[0];

  return (
    <div className="wrap grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch" data-dining-menu>
      {/* Left Column: Story + Real 4-Photo Editorial Collage (defines section height on desktop) */}
      <div className="lg:col-span-5 space-y-5">
        <span className="text-xs uppercase tracking-[0.18em] text-[#8d3f28] font-bold">
          Trải nghiệm ẩm thực & Dịch vụ tại SEEME
        </span>
        <h2
          id="exp-h"
          className="font-display text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-[#221f1c] leading-snug tracking-tight"
        >
          Lẩu nóng, tiệc nướng BBQ và trà sữa Shan Tuyết giữa đêm Lô Lô Chải
        </h2>
        <p className="text-[15px] text-[#47423c] leading-relaxed">
          Chiều lạnh về bản, quây quần ngay hiên nhà tường trình bên nồi lẩu bò Cao Mã, lẩu gà đen
          bản, bếp nướng BBQ than hồng, nhâm nhi bia tam giác mạch và trà sữa Shan Tuyết cổ thụ.
        </p>

        {/* Real 4-Photo Collage */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setLightbox({ src: FOOD_PHOTOS[0].src, alt: FOOD_PHOTOS[0].alt })}
            className="group relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-black/10 bg-[#dcd0bc] block text-left"
            aria-label={`Phóng to ảnh: ${FOOD_PHOTOS[0].alt}`}
          >
            <img
              src={FOOD_PHOTOS[0].src}
              alt={FOOD_PHOTOS[0].alt}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute bottom-2.5 left-2.5 bg-[#221f1c]/80 text-[#f6f1e7] text-xs font-semibold px-2.5 py-1 rounded-md">
              {FOOD_PHOTOS[0].caption}
            </span>
            <span
              className="absolute bottom-2.5 right-2.5 bg-[#221f1c]/80 text-[#f6f1e7] p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            >
              <Expand className="w-3.5 h-3.5" />
            </span>
          </button>

          <div className="grid grid-cols-3 gap-2.5">
            {FOOD_PHOTOS.slice(1).map((photo) => (
              <button
                key={photo.src}
                type="button"
                onClick={() => setLightbox({ src: photo.src, alt: photo.alt })}
                className="group relative aspect-[4/3] rounded-lg overflow-hidden border border-black/10 bg-[#dcd0bc] block"
                aria-label={`Phóng to ảnh: ${photo.alt}`}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Official Tabbed Evening Menu Card (exact height match with left column on desktop; middle list scrolls) */}
      <div className="lg:col-span-7 lg:relative">
        <div className="lg:absolute lg:inset-0 bg-[#f6f1e7] rounded-2xl border border-black/10 p-5 sm:p-7 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/10 shrink-0">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8d3f28]">
                Thực đơn tối chính thức
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#221f1c] mt-0.5">
                Menu SEEME Homestay
              </h3>
            </div>
            <button
              type="button"
              onClick={() =>
                setLightbox({
                  src: '/assets/img/seeme/food-menu-official.jpg',
                  alt: 'Ảnh thực đơn tối chính thức SEEME Homestay (Lẩu, BBQ, Món phụ & Đồ uống)',
                })
              }
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8d3f28] bg-white hover:bg-[#faf7f1] border border-[#8d3f28]/25 px-3 py-2 rounded-lg transition"
            >
              <FileText className="w-3.5 h-3.5" />
              Xem ảnh menu gốc
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Nhóm thực đơn SEEME">
              {MENU_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const count = grouped[tab.id].length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    data-menu-tab={tab.id}
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition border ${
                      isActive
                        ? 'bg-[#221f1c] text-[#f6f1e7] border-[#221f1c]'
                        : 'bg-white text-[#221f1c] border-black/15 hover:border-black/35'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-white/15 text-[#f6f1e7]' : 'bg-[#ebe3d5] text-[#5c5750]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            {activeTabMeta.note && (
              <span
                data-menu-note
                className="text-xs font-semibold text-[#8d3f28] bg-[#ebe3d5]/70 px-3 py-1.5 rounded-lg"
              >
                {activeTabMeta.note}
              </span>
            )}
          </div>

          {/* Scrollable Middle Menu List */}
          <div className="flex-1 min-h-0 max-h-[380px] lg:max-h-none overflow-y-auto pr-2 seeme-menu-scroll">
            {MENU_TABS.map((tab) => {
              const items = grouped[tab.id];
              const isVisible = activeTab === tab.id;
              return (
                <ul
                  key={tab.id}
                  data-menu-panel={tab.id}
                  className={`divide-y divide-black/10 ${isVisible ? 'block' : 'hidden'}`}
                >
                  {items.map((svc) => (
                    <li
                      key={svc.id}
                      className="py-3 first:pt-0.5 last:pb-1 flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="font-display text-base font-bold text-[#221f1c]">{svc.name}</h4>
                        <p className="text-xs sm:text-sm text-[#47423c] leading-relaxed">
                          {svc.description}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-[#8d3f28] text-sm sm:text-base tabular-nums block">
                          {formatVnd(svc.price)}
                        </span>
                        <span className="text-xs text-[#5c5750]">/{svc.unit}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })}
          </div>

          {/* Shan Tuyet Tea Highlight + Booking CTA */}
          <div className="pt-3.5 border-t border-black/10 space-y-3 shrink-0">
            <div className="p-3.5 rounded-xl bg-white border border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <strong className="text-[#221f1c] text-sm block">
                  Quầy Trà sữa Shan Tuyết — Si mê vị trà cổ
                </strong>
                <span className="text-[#5c5750]">
                  Phục vụ ngay tại cổng SEEME Homestay · Nhận đặt trước bữa tối qua mục đặt phòng hoặc
                  Hotline <strong className="text-[#221f1c]">{hotline}</strong>.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#5c5750]">
                Chi phí món ăn được cộng minh bạch ngay khi bạn đặt phòng & chọn thực đơn trước.
              </span>
              <Link href="/book" className="btn btn--primary text-sm">
                Đặt phòng kèm bữa tối
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Food Photos & Official Menu Image */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-[#151311]/95 flex flex-col items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white"
            aria-label="Đóng xem ảnh"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] max-w-[92vw] object-contain rounded-lg"
          />
          <p className="text-center text-xs sm:text-sm text-[#e8e1d7] mt-3 max-w-xl">
            {lightbox.alt}
          </p>
        </div>
      )}
    </div>
  );
}
