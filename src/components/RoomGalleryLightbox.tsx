'use client';

import React, { useState, useEffect } from 'react';
import { Expand, X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface RoomImageData {
  id: number;
  url: string;
  altText: string;
  sourceType: string;
  creditText: string | null;
}

export function RoomGalleryLightbox({
  roomName,
  images,
}: {
  roomName: string;
  images: RoomImageData[];
}) {
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);

  const safeImages =
    images.length > 0
      ? images
      : [
          {
            id: 0,
            url: '/assets/img/seeme/space-2.jpg',
            altText: `Ảnh thực tế ${roomName} tại SEEME Homestay`,
            sourceType: 'official',
            creditText: 'SEEME Homestay Official Fanpage',
          },
        ];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') setSelected((s) => (s + 1) % safeImages.length);
      if (e.key === 'ArrowLeft')
        setSelected((s) => (s - 1 + safeImages.length) % safeImages.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, safeImages.length]);

  const current = safeImages[selected] || safeImages[0];

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative w-full aspect-[16/10] overflow-hidden rounded-xl border border-black/10 bg-[#ebe3d5] block"
        aria-label={`Xem toàn màn hình ảnh ${roomName}`}
      >
        <img
          src={current.url}
          alt={current.altText}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 bg-[#221f1c]/85 text-[#f6f1e7] text-xs font-medium px-3 py-1.5 rounded-md">
          <Expand className="w-3.5 h-3.5" />
          Xem toàn màn hình ({selected + 1}/{safeImages.length})
        </span>
      </button>

      {safeImages.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
          {safeImages.map((img, idx) => (
            <button
              key={img.id || idx}
              type="button"
              onClick={() => setSelected(idx)}
              className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition ${
                selected === idx
                  ? 'border-[#8d3f28]'
                  : 'border-transparent opacity-75 hover:opacity-100'
              }`}
              aria-label={`Chọn ảnh ${idx + 1} của ${roomName}`}
            >
              <img src={img.url} alt={img.altText} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {current.sourceType === 'stand_in' && (
        <p className="text-xs text-[#5c5750]">
          Ảnh chi tiết minh họa ({current.creditText || 'Commons'}) — chủ homestay có thể tải lên
          ảnh chụp thực tế của phòng này trong trang Quản trị.
        </p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-[#151311]/95 flex flex-col justify-between p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="flex items-center justify-between text-[#f6f1e7]">
            <span className="text-sm font-medium">
              {roomName} · {selected + 1}/{safeImages.length}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              aria-label="Đóng lightbox"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div
            className="flex-1 flex items-center justify-center relative my-4"
            onClick={(e) => e.stopPropagation()}
          >
            {safeImages.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setSelected((s) => (s - 1 + safeImages.length) % safeImages.length)
                }
                className="absolute left-2 p-2.5 rounded-full bg-black/60 text-white"
                aria-label="Ảnh trước"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <img
              src={current.url}
              alt={current.altText}
              className="max-h-[78vh] max-w-[90vw] object-contain rounded-lg"
            />
            {safeImages.length > 1 && (
              <button
                type="button"
                onClick={() => setSelected((s) => (s + 1) % safeImages.length)}
                className="absolute right-2 p-2.5 rounded-full bg-black/60 text-white"
                aria-label="Ảnh sau"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-[#c2bab0]">{current.altText}</p>
        </div>
      )}
    </div>
  );
}
