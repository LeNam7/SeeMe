import React from 'react';
import Link from 'next/link';
import { BrandMark } from './BrandMark';
import type { BrandSettingsConfig } from '@/lib/settings';

export function PublicFooter({ brand }: { brand: BrandSettingsConfig }) {
  return (
    <footer
      className="footer closing footer--visit bg-[#221f1c] text-[#f6f1e7]"
      id="lien-he"
      aria-labelledby="close-h"
    >
      <div className="wrap py-16 lg:py-20">
        {/* Section 9: Final Booking CTA */}
        <div className="closing__cta close--photo grid lg:grid-cols-12 gap-8 items-center pb-14 border-b border-white/15">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-xs uppercase tracking-[0.18em] text-[#e39a79]">
              Điểm dừng chân dưới chân Cột cờ Lũng Cú
            </span>
            <h2
              id="close-h"
              className="font-display text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-[#f6f1e7] leading-snug tracking-tight"
            >
              Hẹn bạn một tối ấm bên bếp lửa Lô Lô Chải
            </h2>
            <p className="text-[#d6cfc5] leading-relaxed">
              Kiểm tra lịch phòng thực tế theo ngày, chọn trước bữa tối lẩu bò hay gà nướng tại sân
              và giữ phòng qua VietQR minh bạch.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link className="btn btn--primary" href="/#dat-phong">
                Kiểm tra phòng & Đặt ngay
              </Link>
              <a
                className="btn btn--secondary !bg-transparent !text-[#f6f1e7] !border-white/30"
                href={`https://zalo.me/${brand.zaloPhone}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Nhắn Zalo {brand.hotline}
              </a>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="aspect-[4/3] overflow-hidden rounded-lg border border-white/10">
              <img
                src="/assets/img/seeme/space-1.jpg"
                width={2048}
                height={1536}
                alt="Toàn cảnh SEEME Homestay lên đèn buổi tối giữa mái ngói âm dương thôn Lô Lô Chải"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Section 10: Footer Details & Policies */}
        <div className="pt-12 grid md:grid-cols-12 gap-8 text-sm">
          <div className="md:col-span-5 space-y-4">
            <BrandMark inverted />
            <p className="text-[#c2bab0] leading-relaxed max-w-md">{brand.tagline}</p>
            <address className="not-italic text-[#f6f1e7] space-y-1">
              <div>{brand.address}</div>
              <div className="text-xs text-[#a8a096]">{brand.subAddressNote}</div>
            </address>
            <div className="flex flex-wrap gap-4 pt-1">
              <a
                className="underline decoration-white/30 hover:decoration-[#e39a79] text-[#f6f1e7]"
                href={`tel:${brand.hotlineRaw}`}
              >
                Hotline: {brand.hotline}
              </a>
              <a
                className="underline decoration-white/30 hover:decoration-[#e39a79] text-[#f6f1e7]"
                href={`https://zalo.me/${brand.zaloPhone}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Zalo Homestay
              </a>
            </div>
          </div>

          <div className="md:col-span-3 space-y-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[#e39a79] font-semibold">
              Kết nối & Chỉ đường
            </p>
            <ul className="space-y-2 text-[#d6cfc5]">
              <li>
                <a
                  href={brand.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white underline-offset-4 hover:underline"
                >
                  Fanpage Facebook chính thức
                </a>
              </li>
              <li>
                <a
                  href={brand.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white underline-offset-4 hover:underline"
                >
                  Mở trên Google Maps
                </a>
              </li>
              <li>
                <Link href="/#hang-phong" className="hover:text-white">
                  Danh sách phòng nghỉ
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-white">
                  Cổng quản lý Homestay
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[#e39a79] font-semibold">
              Chính sách & Giờ phục vụ
            </p>
            <ul className="space-y-2 text-[#d6cfc5]">
              <li>Nhận phòng tiêu chuẩn: 14:00 · Trả phòng: 12:00</li>
              <li>Tư vấn trực tiếp: Luôn mở cửa ({brand.hotline})</li>
              <li>
                <Link href="/terms" className="underline decoration-white/30 hover:text-white">
                  Chính sách đặt phòng & Hoàn/Hủy/Đổi
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="underline decoration-white/30 hover:text-white">
                  Chính sách bảo mật thông tin
                </Link>
              </li>
              <li>
                <Link href="/credits" className="underline decoration-white/30 hover:text-white">
                  Nguồn hình ảnh thực tế tại SEEME
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-3 text-xs text-[#a8a096]">
          <span>&copy; {new Date().getFullYear()} {brand.name} — Thôn Lô Lô Chải, Lũng Cú.</span>
        </div>
      </div>

      {/* Mobile sticky action bar matching taste-skill place ergonomics */}
      <nav
        className="actionbar fixed bottom-0 inset-x-0 z-30 lg:hidden bg-[#f6f1e7] border-t border-black/15 px-4 py-2.5 flex items-center gap-2 text-[#221f1c]"
        aria-label="Hành động nhanh"
      >
        <a
          href={`tel:${brand.hotlineRaw}`}
          className="btn btn--secondary flex-1 text-center text-sm py-2"
        >
          Gọi {brand.hotline}
        </a>
        <Link href="/#dat-phong" className="btn btn--primary flex-1 text-center text-sm py-2">
          Đặt phòng ngay
        </Link>
      </nav>
    </footer>
  );
}
