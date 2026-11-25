'use client';

import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Expand } from 'lucide-react';

export interface GalleryItem {
  id: string;
  category: 'Ngoại cảnh & Kiến trúc' | 'Không gian chung' | 'Phòng nghỉ';
  src: string;
  srcSet?: string;
  alt: string;
  credit: string;
  width: number;
  height: number;
  spanWide?: boolean;
}

const CATEGORIES = ['Tất cả', 'Ngoại cảnh & Kiến trúc', 'Không gian chung', 'Phòng nghỉ'] as const;

export function GalleryWithLightbox({ items }: { items: GalleryItem[] }) {
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>('Tất cả');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visibleItems =
    activeCategory === 'Tất cả' ? items : items.filter((item) => item.category === activeCategory);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight')
        setLightboxIndex((i) => (i === null ? null : (i + 1) % visibleItems.length));
      if (e.key === 'ArrowLeft')
        setLightboxIndex((i) =>
          i === null ? null : (i - 1 + visibleItems.length) % visibleItems.length
        );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, visibleItems.length]);

  const currentItem = lightboxIndex !== null ? visibleItems[lightboxIndex] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bộ lọc bộ sưu tập ảnh">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat}
            onClick={() => {
              setActiveCategory(cat);
              setLightboxIndex(null);
            }}
            className={`px-4 py-2 text-sm rounded-md transition border ${
              activeCategory === cat
                ? 'bg-[#221f1c] text-[#f6f1e7] border-[#221f1c]'
                : 'bg-white text-[#221f1c] border-black/15 hover:border-black/40'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleItems.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLightboxIndex(idx)}
            className="group text-left rounded-lg overflow-hidden border border-black/10 bg-[#ebe3d5] focus:outline-none focus:ring-2 focus:ring-[#8d3f28]"
            aria-label={`Phóng to ảnh: ${item.alt}`}
          >
            <div className="relative w-full aspect-[4/3] overflow-hidden">
              <img
                src={item.src}
                srcSet={item.srcSet}
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 34vw"
                width={item.width}
                height={item.height}
                alt={item.alt}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <span
                className="absolute bottom-3 right-3 bg-[#221f1c]/80 text-[#f6f1e7] p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-hidden="true"
              >
                <Expand className="w-4 h-4" />
              </span>
            </div>
          </button>
        ))}
      </div>

      {currentItem && (
        <div
          className="fixed inset-0 z-50 bg-[#151311]/95 flex flex-col justify-between p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh toàn màn hình"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="flex items-center justify-between text-[#f6f1e7]">
            <span className="text-xs uppercase tracking-[0.16em] text-[#c2bab0]">
              {currentItem.category} · {(lightboxIndex ?? 0) + 1}/{visibleItems.length}
            </span>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              aria-label="Đóng xem ảnh"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="flex-1 flex items-center justify-center relative my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((i) =>
                  i === null ? null : (i - 1 + visibleItems.length) % visibleItems.length
                )
              }
              className="absolute left-1 sm:left-4 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white"
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <img
              src={currentItem.src}
              alt={currentItem.alt}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-md"
            />

            <button
              type="button"
              onClick={() =>
                setLightboxIndex((i) => (i === null ? null : (i + 1) % visibleItems.length))
              }
              className="absolute right-1 sm:right-4 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white"
              aria-label="Ảnh tiếp theo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div
            className="text-center text-sm text-[#e8e1d7] max-w-2xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-medium">{currentItem.alt}</p>
            <p className="text-xs text-[#a8a096] mt-1">{currentItem.credit}</p>
          </div>
        </div>
      )}
    </div>
  );
}
