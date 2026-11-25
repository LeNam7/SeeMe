import React from 'react';
import Link from 'next/link';
import { ensureSeeded } from '@/db/seed';
import { getAllSiteSettings } from '@/lib/settings';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nguồn hình ảnh chính thức — SEEME Homestay',
};

export default async function CreditsPage() {
  await ensureSeeded();
  const { brand } = await getAllSiteSettings();

  const items = [
    {
      album: 'Album Không gian & Ngoại cảnh',
      role: 'Ảnh chính Hero, không gian sân hiên, tường trình đất, mái ngói âm dương & cổng đá Lô Lô Chải',
      files: 'space-1.jpg .. space-5.jpg, cover-3.jpg',
    },
    {
      album: 'Album Phòng Khách',
      role: 'Không gian sinh hoạt chung, góc trà ấm, đèn gốm bản địa & hiên gỗ đón sáng',
      files: 'living-1.jpg, living-3.jpg, living-4.jpg, living-5.jpg',
    },
    {
      album: 'Album Phòng Hoa Lê',
      role: 'Bộ ảnh thực tế Phòng Hoa Lê (giường đôi, nội thất gỗ, WC khép kín & chi tiết trang trí)',
      files: 'hoa-le-*.jpg',
    },
    {
      album: 'Album Phòng Anh Đào',
      role: 'Bộ ảnh thực tế Phòng Anh Đào (giường đôi & giường đơn, tranh thổ cẩm, biển gỗ & WC khép kín)',
      files: 'anh-dao-1.jpg .. anh-dao-5.jpg',
    },
    {
      album: 'Album Phòng Lô Lô Hoa',
      role: 'Bộ ảnh thực tế Phòng Lô Lô Hoa (02 giường đôi Queen, bàn trà, vòi đồng & tường đất trang trí)',
      files: 'lo-lo-hoa-1.jpg .. lo-lo-hoa-5.jpg',
    },
    {
      album: 'Album Phòng Mộc Miên',
      role: 'Bộ ảnh thực tế Phòng Mộc Miên (03 giường đôi Queen, trần gỗ lớn, bàn trà & bồn rửa đôi)',
      files: 'moc-mien-1.jpg .. moc-mien-5.jpg',
    },
  ];

  return (
    <>
      <PublicHeader hotline={brand.hotline} hotlineRaw={brand.hotlineRaw} />
      <main className="pt-24 lg:pt-28 pb-24 lg:pb-16">
        <div className="wrap max-w-3xl space-y-6">
          <Link href="/" className="text-xs text-[#5c5750] hover:text-[#8d3f28]">
            ← Quay lại trang chủ
          </Link>
          <h1 className="font-display text-3xl font-normal text-[#221f1c]">
            Nguồn hình ảnh chính thức SEEME Homestay
          </h1>
          <p className="text-sm text-[#3c342e]">
            Toàn bộ hình ảnh không gian, nội thất và bốn hạng phòng trên website được lưu trữ trực
            tiếp từ bộ album công khai trên{' '}
            <a
              href={brand.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[#8d3f28]"
            >
              Fanpage chính thức SEEME Homestay
            </a>
            . Chủ nhà có thể cập nhật thêm ảnh mới bất cứ lúc nào trong trang{' '}
            <strong>Quản trị → Phòng & Ảnh</strong>.
          </p>
          <ul className="divide-y divide-black/10 border-t border-b border-black/10 text-sm">
            {items.map((it) => (
              <li key={it.album} className="py-3 space-y-1">
                <strong className="block text-[#221f1c]">{it.album}</strong>
                <span className="text-xs text-[#5c5750] block">{it.role}</span>
                <code className="text-[11px] text-[#8d3f28]">/assets/img/seeme/{it.files}</code>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <PublicFooter brand={brand} />
    </>
  );
}
