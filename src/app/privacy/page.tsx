import React from 'react';
import Link from 'next/link';
import { ensureSeeded } from '@/db/seed';
import { getAllSiteSettings } from '@/lib/settings';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chính sách bảo mật thông tin',
};

export default async function PrivacyPage() {
  await ensureSeeded();
  const { brand } = await getAllSiteSettings();

  return (
    <>
      <PublicHeader hotline={brand.hotline} hotlineRaw={brand.hotlineRaw} />
      <main className="pt-24 lg:pt-28 pb-24 lg:pb-16">
        <div className="wrap max-w-3xl space-y-6 text-sm text-[#3c342e] leading-relaxed">
          <Link href="/" className="text-xs text-[#5c5750] hover:text-[#8d3f28]">
            ← Quay lại trang chủ
          </Link>
          <h1 className="font-display text-3xl lg:text-4xl font-normal text-[#221f1c]">
            Chính sách Bảo mật Thông tin Khách hàng
          </h1>
          <p>
            {brand.name} chỉ thu thập Họ tên, Số điện thoại, Email (nếu cung cấp) và ghi chú lưu trú
            phục vụ mục đích xác nhận lịch đặt phòng, chuẩn bị phòng, chuẩn bị bữa ăn hoặc dịch vụ đi
            kèm và liên hệ hỗ trợ di chuyển tới {brand.address}.
          </p>
          <p>
            Mọi thông tin giao dịch chuyển khoản VietQR được lưu vết phục vụ đối soát hóa đơn và giữ
            phòng chính xác, tuyệt đối không chia sẻ cho bên thứ ba ngoài mục đích lưu trú.
          </p>
          <p>
            Nếu cần cập nhật hoặc xóa dữ liệu khách hàng, vui lòng liên hệ trực tiếp Hotline:{' '}
            <strong>{brand.hotline}</strong>.
          </p>
        </div>
      </main>
      <PublicFooter brand={brand} />
    </>
  );
}
