import React from 'react';
import Link from 'next/link';
import { asc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { getAllSiteSettings } from '@/lib/settings';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { AvailabilityWidget } from '@/components/AvailabilityWidget';
import { DiningMenuSection } from '@/components/DiningMenuSection';
import { GalleryWithLightbox, type GalleryItem } from '@/components/GalleryWithLightbox';
import { SeemeFilmSection } from '@/components/SeemeFilmSection';
import { getResponsiveImageAttrs } from '@/lib/media';

export const dynamic = 'force-dynamic';

const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'seeme-exterior-dusk',
    category: 'Ngoại cảnh & Kiến trúc',
    src: '/assets/img/seeme/space-2.jpg',
    width: 2048,
    height: 1536,
    alt: 'Toàn cảnh SEEME Homestay tường trình đất, mái ngói âm dương lên đèn dưới dãy núi Lô Lô Chải',
    credit: 'Ảnh thực tế SEEME Homestay (Album Không gian)',
  },
  {
    id: 'seeme-porch-sign',
    category: 'Ngoại cảnh & Kiến trúc',
    src: '/assets/img/seeme/space-3.jpg',
    width: 2048,
    height: 1365,
    alt: 'Hiên gỗ mộc chạm khắc, tường đất nện vàng ấm và biển hiệu gỗ SEEME Homestay',
    credit: 'Ảnh thực tế SEEME Homestay (Album Không gian)',
  },
  {
    id: 'seeme-stone-gate',
    category: 'Ngoại cảnh & Kiến trúc',
    src: '/assets/img/seeme/space-4.jpg',
    width: 1365,
    height: 2048,
    alt: 'Cổng đá xếp tay truyền thống và mái ngói âm dương rêu phong trước sân SEEME',
    credit: 'Ảnh thực tế SEEME Homestay (Album Không gian)',
  },
  {
    id: 'seeme-living-cabinet',
    category: 'Không gian chung',
    src: '/assets/img/seeme/living-1.jpg',
    width: 2048,
    height: 1638,
    alt: 'Góc tủ gỗ mộc, bình gốm và cánh cửa mở thẳng ra hiên gỗ sinh hoạt chung',
    credit: 'Ảnh thực tế SEEME Homestay (Album Phòng Khách)',
  },
  {
    id: 'seeme-living-lamp',
    category: 'Không gian chung',
    src: '/assets/img/seeme/living-4.jpg',
    width: 1365,
    height: 2048,
    alt: 'Đèn bàn gốm vẽ tay phong cảnh bản Lô Lô Chải và khăn dệt thổ cẩm tại phòng khách',
    credit: 'Ảnh thực tế SEEME Homestay (Album Phòng Khách)',
  },
  {
    id: 'seeme-living-tea',
    category: 'Không gian chung',
    src: '/assets/img/seeme/living-5.jpg',
    width: 1638,
    height: 2048,
    alt: 'Bộ ấm chén gốm nâu trên khăn thổ cẩm đón khách thưởng trà ấm giữa tiết trời Lũng Cú',
    credit: 'Ảnh thực tế SEEME Homestay (Album Phòng Khách)',
  },
  {
    id: 'room-hoa-le',
    category: 'Phòng nghỉ',
    src: '/assets/img/seeme/hoa-le-bed-1.jpg',
    width: 1538,
    height: 2048,
    alt: 'Phòng Hoa Lê với giường đôi Queen 2m x 2,2m, tường trình đất và bàn trà đèn ngủ ấm áp',
    credit: 'Ảnh thực tế SEEME Homestay (Album Phòng Hoa Lê)',
  },
  {
    id: 'room-anh-dao',
    category: 'Phòng nghỉ',
    src: '/assets/img/seeme/anh-dao-1.jpg',
    width: 2048,
    height: 1365,
    alt: 'Phòng Anh Đào ấm cúng với sắc chăn ga đỏ trầm và gối hoa văn bản địa',
    credit: 'Ảnh thực tế SEEME Homestay (Album Phòng Anh Đào)',
  },
  {
    id: 'room-moc-mien',
    category: 'Phòng nghỉ',
    src: '/assets/img/seeme/moc-mien-1.jpg',
    width: 2048,
    height: 1365,
    alt: 'Phòng Mộc Miên rộng rãi cho 6 khách với hệ kèo gỗ cao, 3 giường đôi và góc trà bệt',
    credit: 'Ảnh thực tế SEEME Homestay (Album Phòng Mộc Miên)',
  },
];

export default async function HomePage() {
  await ensureSeeded();
  const settings = await getAllSiteSettings();

  const roomRows = await db
    .select()
    .from(schema.rooms)
    .where(eq(schema.rooms.isActive, true))
    .orderBy(asc(schema.rooms.sortOrder));

  const roomIds = roomRows.map((r) => r.id);
  const imgRows =
    roomIds.length > 0
      ? await db
          .select()
          .from(schema.roomImages)
          .where(inArray(schema.roomImages.roomId, roomIds))
          .orderBy(asc(schema.roomImages.sortOrder))
      : [];

  const services = await db
    .select()
    .from(schema.extraServices)
    .where(eq(schema.extraServices.isAvailable, true))
    .orderBy(asc(schema.extraServices.sortOrder));

  const reviewRows = await db
    .select()
    .from(schema.reviews)
    .where(eq(schema.reviews.isPublished, true))
    .orderBy(asc(schema.reviews.sortOrder));

  const roomsWithPrimary = roomRows.map((room) => {
    const imgs = imgRows.filter((im) => im.roomId === room.id);
    const primary = imgs.find((im) => im.isPrimary) || imgs[0];
    const primaryImageUrl = primary?.url || '/assets/img/seeme/hoa-le-bed-1.jpg';
    return {
      ...room,
      primaryImageUrl,
      primaryImageAlt: primary?.altText || `Ảnh thực tế ${room.name}`,
      imgAttrs: getResponsiveImageAttrs(primaryImageUrl, '(max-width: 767px) 100vw, 45vw'),
    };
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: settings.brand.name,
    description: settings.brand.tagline,
    telephone: settings.brand.hotlineRaw,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Thôn Lô Lô Chải, Xã Lũng Cú',
      addressLocality: 'Đồng Văn',
      addressRegion: 'Hà Giang',
      addressCountry: 'VN',
    },
    sameAs: [settings.brand.facebookUrl],
    checkinTime: settings.policy.checkInTime,
    checkoutTime: settings.policy.checkOutTime,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicHeader hotline={settings.brand.hotline} hotlineRaw={settings.brand.hotlineRaw} />

      <main id="top" className="pb-16 lg:pb-0">
        {/* SECTION 1: Hero Experience — Full-bleed landscape photograph + editorial type on warm earthen ground below */}
        <section className="hero hero--place" data-enter aria-labelledby="hero-h">
          <picture className="hero__bg" data-phone-fill>
            <img
              src="/assets/img/seeme/space-2.jpg"
              width={2048}
              height={1536}
              alt="SEEME Homestay nhà tường trình đất mái ngói âm dương lên đèn giữa thôn Lô Lô Chải, Lũng Cú"
              fetchPriority="high"
            />
          </picture>

          <div className="wrap">
            <div className="hero-text">
              <div className="hero__text">
                <h1 id="hero-h" className="font-display">
                  SEEME (SI MÊ) — Nhà nhỏ dưới chân Cột cờ Lũng Cú
                </h1>
                <p className="hero__lead">
                  {settings.brand.tagline} Nếp nhà tường trình, mái ngói âm dương giữa thôn Lô Lô
                  Chải, mở cửa đón bạn mọi ngày trong tuần.
                </p>
                <div className="btn-row flex flex-wrap gap-3">
                  <a className="btn btn--primary" href="#dat-phong">
                    Đặt phòng ngay
                  </a>
                  <a className="btn btn--secondary" href="#khong-gian">
                    Khám phá không gian
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Brand Story & Live Database Availability Widget */}
        <section className="section py-14 lg:py-20" id="cau-chuyen" aria-labelledby="story-h">
          <div className="wrap space-y-14">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              <div className="lg:col-span-6 space-y-5">
                <span className="seeme-badge">Câu chuyện SEEME</span>
                <h2
                  id="story-h"
                  className="font-display text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-[#221f1c] leading-snug tracking-tight"
                >
                  Đặt chân tới Lô Lô Chải một lần, giữ lại hơi ấm bếp lửa cả bốn mùa
                </h2>
                <p className="text-[15px] sm:text-base text-[#47423c] leading-relaxed">
                  Nằm trong lòng thôn Lô Lô Chải — ngôi làng tường trình cổ dưới chân Cột cờ Lũng
                  Cú — SEEME giữ trọn cấu trúc nhà đất nện vàng ấm, mái ngói âm dương sẫm màu và
                  khung cửa gỗ bản địa mở thẳng ra nương đá.
                </p>
                <p className="text-[15px] sm:text-base text-[#221f1c] font-medium leading-relaxed border-l-2 border-[#8d3f28]/50 pl-4 py-0.5">
                  Ban ngày men theo triền núi đá tai mèo lên Cực Bắc; chiều về quây quần bên nồi
                  lẩu bò, gà nướng và khoai ngô vùi than hồng giữa sân nhà nhỏ.
                </p>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-black/10 text-sm">
                  <div>
                    <strong className="block font-display text-2xl font-semibold text-[#8d3f28] tabular-nums">04</strong>
                    <span className="text-xs text-[#5c5750]">Hạng phòng khép kín</span>
                  </div>
                  <div>
                    <strong className="block font-display text-2xl font-semibold text-[#8d3f28] tabular-nums">2 – 6</strong>
                    <span className="text-xs text-[#5c5750]">Khách / phòng</span>
                  </div>
                  <div>
                    <strong className="block font-display text-2xl font-semibold text-[#8d3f28] tabular-nums">100%</strong>
                    <span className="text-xs text-[#5c5750]">16 đánh giá đề xuất</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 flex justify-center lg:justify-end">
                <figure className="rounded-xl overflow-hidden border border-black/10 bg-[#ebe3d5] w-full max-w-[460px]">
                  <img
                    src="/assets/img/seeme/space-3.jpg"
                    width={2048}
                    height={1365}
                    alt="Hiên gỗ mộc, tường trình đất vàng ấm và biển gỗ SEEME Homestay tại thôn Lô Lô Chải"
                    loading="lazy"
                    decoding="async"
                    className="w-full aspect-[4/3] object-cover"
                  />
                </figure>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2B: Official Cinematic Brand Film */}
        <SeemeFilmSection />

        {/* SECTION 3: The Space — Non-uniform Architectural Showcase */}
        <section
          className="section bg-[#ebe3d5] py-14 lg:py-20"
          id="khong-gian"
          aria-labelledby="space-h"
        >
          <div className="wrap space-y-10">
            <div className="max-w-2xl space-y-3">
              <span className="text-xs uppercase tracking-[0.18em] text-[#8d3f28] font-semibold">
                Không gian đặc trưng
              </span>
              <h2
                id="space-h"
                className="font-display text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-[#221f1c] leading-snug tracking-tight"
              >
                Tường trình đất nện, mái ngói âm dương và hơi ấm cao nguyên
              </h2>
              <p className="text-[15px] text-[#47423c] leading-relaxed">
                Không gian tại SEEME giữ sự giao hòa giữa chất liệu truyền thống của người Lô Lô và
                tiện nghi giữ ấm hiện đại trong từng chi tiết nhỏ.
              </p>
            </div>

            {/* Varied Editorial Spread */}
            <div className="grid lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-4">
                <div
                  className="aspect-[16/10] rounded-xl overflow-hidden border border-black/10 bg-[#dcd0bc]"
                  data-moment="picture-develops"
                >
                  <img
                    src="/assets/img/seeme/space-1.jpg"
                    width={2048}
                    height={1536}
                    alt="Toàn cảnh SEEME Homestay sáng đèn buổi tối giữa những mái ngói âm dương thôn Lô Lô Chải"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="pt-1 space-y-1.5">
                  <h3 className="font-display text-lg sm:text-xl font-bold text-[#221f1c]">
                    Cảnh quan Lô Lô Chải & Cột cờ Lũng Cú
                  </h3>
                  <p className="text-sm text-[#47423c] leading-relaxed max-w-xl">
                    Từ cửa homestay phóng tầm mắt qua những mái ngói âm dương của thôn cổ, sáng sớm
                    đón sương luồn qua triền đá tai mèo hướng lên đỉnh Cột cờ Quốc Gia.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 grid gap-5">
                <div className="bg-[#f6f1e7] p-5 rounded-xl border border-black/10 space-y-3">
                  <div className="aspect-[16/9] rounded-lg overflow-hidden">
                    <img
                      src="/assets/img/seeme/living-1.jpg"
                      width={2048}
                      height={1638}
                      alt="Không gian nội thất gỗ mộc, tường đất vàng ấm và bình gốm bản địa tại SEEME"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#221f1c]">
                    Nội thất gỗ – đá trầm ấm & sưởi nhiệt
                  </h3>
                  <p className="text-sm text-[#47423c] leading-relaxed">
                    Phòng nghỉ sử dụng đệm lò xo 25cm, chăn bông dày, đèn ngủ vàng dịu kết hợp điều
                    hòa 2 chiều hoặc máy sưởi dầu và đèn sưởi nhà tắm thông minh.
                  </p>
                </div>

                <div className="bg-[#f6f1e7] p-5 rounded-xl border border-black/10 space-y-2">
                  <h3 className="font-display text-lg font-bold text-[#221f1c]">
                    Sân bếp lửa, quầy trà ấm & góc check-in cổng gỗ
                  </h3>
                  <p className="text-sm text-[#47423c] leading-relaxed">
                    Khoảng sân lát đá chung là nơi khách ngồi uống trà sữa Shan Tuyết, nhâm nhi ấm
                    trà đất buổi chiều và quây quần nướng khoai ngô, ăn lẩu bò khi đêm Lũng Cú
                    xuống lạnh.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Accommodation (4 Verified Rooms from PostgreSQL) */}
        <section className="section py-14 lg:py-20" id="hang-phong" aria-labelledby="rooms-h">
          <div className="wrap space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <span className="seeme-badge">Hệ thống phòng nghỉ tại SEEME</span>
                <h2
                  id="rooms-h"
                  className="font-display text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-[#221f1c] leading-snug tracking-tight"
                >
                  Bốn căn phòng mang tên hoa núi đá
                </h2>
                <p className="text-[#3c342e]">
                  Mỗi phòng đều có WC khép kín, đệm lò xo 25cm và đầy đủ tiện nghi giữ ấm. Mức giá
                  dưới đây được đồng bộ trực tiếp từ hệ thống quản trị.
                </p>
              </div>
              <Link href="/book" className="btn btn--secondary shrink-0">
                Đặt nhiều phòng / Nguyên căn
              </Link>
            </div>

            <AvailabilityWidget rooms={roomsWithPrimary} />
          </div>
        </section>

        {/* SECTION 5: Official Evening Menu, Dining Photos & Extra Services (from PostgreSQL) */}
        <section
          className="section bg-[#ebe3d5] py-14 lg:py-20"
          id="trai-nghiem"
          aria-labelledby="exp-h"
        >
          <DiningMenuSection services={services} hotline={settings.brand.hotline} />
        </section>

        {/* SECTION 6: Gallery with Interactive Lightbox */}
        <section className="section py-14 lg:py-20" id="bo-suu-tap" aria-labelledby="gal-h">
          <div className="wrap space-y-8">
            <div className="max-w-2xl space-y-2">
              <span className="seeme-badge">Bộ sưu tập hình ảnh</span>
              <h2
                id="gal-h"
                className="font-display text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-[#221f1c] leading-snug tracking-tight"
              >
                Cao nguyên đá, nếp nhà trình tường và góc nghỉ bình yên
              </h2>
              <p className="text-sm text-[#47423c]">
                Bấm vào từng ảnh để xem kích thước toàn màn hình. Toàn bộ ảnh được chụp thực tế tại
                SEEME Homestay, thôn Lô Lô Chải.
              </p>
            </div>
            <GalleryWithLightbox items={GALLERY_ITEMS} />
          </div>
        </section>

        {/* SECTION 7: Verified Guest Experience */}
        <section
          className="section bg-[#ebe3d5] py-14 lg:py-20"
          id="cam-nhan"
          aria-labelledby="rev-h"
        >
          <div className="wrap space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <span className="text-xs uppercase tracking-[0.18em] text-[#8d3f28] font-semibold">
                  Cảm nhận thực tế từ khách lưu trú
                </span>
                <h2
                  id="rev-h"
                  className="font-display text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-[#221f1c] leading-snug tracking-tight"
                >
                  100% khách đánh giá trên Fanpage đề xuất quay lại SEEME
                </h2>
              </div>
              <a
                href={settings.brand.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[#8d3f28] hover:underline"
              >
                Xem nguồn đánh giá trên Facebook Fanpage →
              </a>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {reviewRows.map((rev) => (
                <blockquote
                  key={rev.id}
                  className="bg-[#f6f1e7] border border-black/10 rounded-xl p-6 space-y-4"
                >
                  <p className="text-[#221f1c] leading-relaxed text-[15px] sm:text-base">
                    “{rev.quote}”
                  </p>
                  <footer className="flex items-center justify-between text-xs text-[#47423c] pt-3 border-t border-black/10">
                    <strong className="text-sm font-semibold text-[#221f1c] not-italic">
                      {rev.authorName}
                    </strong>
                    <span>
                      {rev.sourceLabel} · {rev.sourceDate}
                    </span>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 8: Location, Transit Directions & Map */}
        <section className="section py-14 lg:py-20" id="vi-tri" aria-labelledby="loc-h">
          <div className="wrap grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-5">
              <span className="seeme-badge">Vị trí & Chỉ đường</span>
              <h2
                id="loc-h"
                className="font-display text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-[#221f1c] leading-snug tracking-tight"
              >
                Đến Thôn Lô Lô Chải dưới chân Cột cờ Lũng Cú
              </h2>

              <div className="space-y-3 text-sm text-[#3c342e]">
                <p>
                  <strong className="text-[#221f1c] block">Địa chỉ:</strong>
                  {settings.brand.address}
                </p>
                <p>
                  <strong className="text-[#221f1c] block">Hướng dẫn di chuyển:</strong>
                  Từ trung tâm thị trấn Đồng Văn đi theo hướng Lũng Cú khoảng 25 km (45–60 phút qua
                  đường đèo núi đá). Tới ngã rẽ chân Cột cờ Quốc Gia Lũng Cú, rẽ vào cổng thôn Lô Lô
                  Chải đi thẳng vào trung tâm bản là gặp cổng gỗ SEEME.
                </p>
              </div>

              <div className="pt-2 border-t border-black/10 space-y-2 text-sm">
                <h3 className="font-display text-lg font-bold text-[#221f1c]">
                  Giờ đón tiếp & Liên hệ trực tiếp
                </h3>
                <dl className="hours space-y-1 text-[#3c342e]" data-tz="Asia/Ho_Chi_Minh">
                  <div className="flex justify-between">
                    <dt data-days="mon-sun">Thứ Hai đến Chủ Nhật</dt>
                    <dd>Mở cửa cả ngày · Nhận phòng {settings.policy.checkInTime}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-3 pt-2">
                  <a href={`tel:${settings.brand.hotlineRaw}`} className="btn btn--primary text-sm">
                    Gọi {settings.brand.hotline}
                  </a>
                  <a
                    href={settings.brand.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--secondary text-sm"
                  >
                    Chỉ đường Google Maps
                  </a>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-xl overflow-hidden border border-black/15 bg-[#ebe3d5] aspect-[16/10] relative">
                <iframe
                  title="Bản đồ Google Maps vị trí SEEME Homestay tại Thôn Lô Lô Chải, Lũng Cú, Hà Giang"
                  src={settings.brand.googleMapsEmbedUrl}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full border-0 block"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter brand={settings.brand} />
    </>
  );
}
