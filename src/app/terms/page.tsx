import React from 'react';
import Link from 'next/link';
import { ensureSeeded } from '@/db/seed';
import { getAllSiteSettings } from '@/lib/settings';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chính sách đặt phòng & Hoàn/Hủy/Đổi',
  description:
    'Chính sách đặt phòng, thanh toán VietQR và quy định hoàn/hủy/đổi phòng (bao gồm mốc 3 ngày, 7 ngày, Lễ/Tết và đoàn nhóm) tại SEEME Homestay.',
};

export default async function TermsPage() {
  await ensureSeeded();
  const { brand, policy } = await getAllSiteSettings();

  return (
    <>
      <PublicHeader hotline={brand.hotline} hotlineRaw={brand.hotlineRaw} />
      <main className="pt-24 lg:pt-28 pb-24 lg:pb-16">
        <div className="wrap max-w-3xl space-y-8">
          <div className="space-y-2 border-b border-black/10 pb-5">
            <Link href="/" className="text-xs text-[#5c5750] hover:text-[#8d3f28]">
              ← Quay lại trang chủ
            </Link>
            <h1 className="font-display text-3xl lg:text-4xl font-normal text-[#221f1c]">
              Chính sách Đặt phòng & Hoàn / Hủy / Đổi phòng
            </h1>
            <p className="text-sm text-[#5c5750]">
              Cấu hình vận hành hiện hành của {brand.name} — đồng bộ trực tiếp từ hệ thống Quản trị.
            </p>
          </div>

          <section className="space-y-3 text-sm text-[#3c342e] leading-relaxed">
            <h2 className="font-display text-2xl text-[#221f1c]">
              1. Quy định mốc hoàn / hủy / đổi phòng
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Hủy/Đổi từ đủ {policy.fullRefundDaysBefore} ngày trở lên trước check-in:</strong>{' '}
                Hoàn <strong>100%</strong> tiền phòng.
              </li>
              <li>
                <strong>
                  Hủy/Đổi từ đủ {policy.partialRefundDaysBefore} ngày đến dưới{' '}
                  {policy.fullRefundDaysBefore} ngày trước check-in:
                </strong>{' '}
                Hoàn <strong>{policy.partialRefundPercent}%</strong> tiền phòng.
              </li>
              <li>
                <strong>Hủy/Đổi trong vòng dưới {policy.noRefundUnderDays} ngày:</strong> Không
                hoàn tiền phòng (0%).
              </li>
              <li>
                <strong>Giai đoạn Lễ / Tết:</strong>{' '}
                {policy.holidayNonRefundable
                  ? 'Mất 100% tiền phòng, không hoàn và không đổi ngày.'
                  : 'Áp dụng quy định thông thường.'}
              </li>
              <li>
                <strong>Khách đặt nhóm từ {policy.groupRoomThreshold} phòng trở lên hoặc đặt nguyên căn:</strong>{' '}
                Phải báo hủy hoặc đổi ngày trước tối thiểu <strong>{policy.groupMinNoticeDays} ngày</strong>.
              </li>
            </ul>
            <div className="p-4 rounded-lg bg-[#ebe3d5] border border-black/10 text-xs text-[#221f1c]">
              <strong>Quy tắc làm rõ các mốc giao nhau (mốc {policy.partialRefundDaysBefore} ngày, mốc{' '}
              {policy.fullRefundDaysBefore} ngày & ngày Lễ):</strong>
              <p className="mt-1 leading-relaxed">{policy.boundaryRuleNote}</p>
            </div>
          </section>

          <section className="space-y-3 text-sm text-[#3c342e] leading-relaxed">
            <h2 className="font-display text-2xl text-[#221f1c]">
              2. Quy trình xác nhận & Thanh toán VietQR
            </h2>
            <p>
              Quy trình đặt phòng:{' '}
              <strong>
                Đặt phòng & Thanh toán VietQR trực tiếp (Đang thanh toán → Đã hoàn tất)
              </strong>
              . Hệ thống tự động tạm giữ phòng trong thời gian thanh toán và lưu cố định lịch phòng
              trong cơ sở dữ liệu ngay khi hoàn tất 100% giá trị tiền phòng và dịch vụ bổ sung.
            </p>
            <p>
              Giờ nhận phòng tiêu chuẩn: <strong>{policy.checkInTime}</strong> · Giờ trả phòng tiêu
              chuẩn: <strong>{policy.checkOutTime}</strong>. Thời hạn hoàn tất chuyển khoản VietQR là{' '}
              <strong>{policy.holdMinutesPayment} phút</strong> kể từ khi mã QR được kích hoạt.
            </p>
          </section>

          <div className="pt-4">
            <Link href="/book" className="btn btn--primary">
              Tiếp tục đặt phòng
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter brand={brand} />
    </>
  );
}
