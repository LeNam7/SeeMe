import { db, ensureDbSchema, schema } from '@/db';
import { ensureSettingDefaultsExist } from '@/lib/settings';
import { count } from 'drizzle-orm';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      await ensureDbSchema();
      await ensureSettingDefaultsExist();

      const [{ value: roomCount }] = await db.select({ value: count() }).from(schema.rooms);
      if (Number(roomCount) > 0) return;

      const roomsData = [
        {
          slug: 'hoa-le',
          name: 'Phòng Hoa Lê',
          subtitle: 'Phòng đôi tiêu chuẩn 2 khách · Giường Queen 2m x 2,2m',
          description:
            'Không gian ấm cúng dành cho cặp đôi hoặc khách đi lẻ, bài trí gỗ tự nhiên kết hợp tường trình đất giữ ấm mùa đông và thoáng mát mùa hè tại thôn Lô Lô Chải.',
          standardCapacity: 2,
          maxCapacity: 2,
          bedConfig: 'Một giường đôi Queen Size (2m x 2,2m)',
          sizeSqm: 22,
          bathroomType: 'WC khép kín',
          viewType: 'Hướng bản Lô Lô Chải & vườn nhà',
          amenities: [
            'Điều hòa 2 chiều',
            'Đèn ngủ',
            'Máy sấy tóc',
            'Thiết bị vệ sinh cao cấp',
            'Đèn sưởi nhà tắm thông minh',
            'Đệm lò xo 25cm',
            'Chăn bông',
            'Khăn tắm',
            'Dép đi trong nhà',
            'Giá để đồ',
            'Móc treo quần áo',
            'Bàn trà',
          ],
          highlights: [
            'WC khép kín riêng tư',
            'Điều hòa 2 chiều & đèn sưởi nhà tắm',
            'Bàn trà riêng đón sáng sớm cao nguyên',
          ],
          baseWeekdayPrice: 950_000,
          baseWeekendPrice: 1_150_000,
          totalUnits: 1,
          isPriceConfigured: false,
          isActive: true,
          sortOrder: 1,
          images: [
            {
              url: '/assets/img/seeme/hoa-le-bed-1.jpg',
              altText: 'Phòng Hoa Lê — Giường đôi Queen Size 2m x 2,2m, tường trình đất và bàn trà đèn ngủ ấm áp',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Hoa Lê)',
              isPrimary: true,
            },
            {
              url: '/assets/img/seeme/hoa-le-bed-2.jpg',
              altText: 'Phòng Hoa Lê — Toàn cảnh phòng nghỉ với trần gỗ, giá treo đồ và tường đất nện',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Hoa Lê)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/hoa-le-3.jpg',
              altText: 'Phòng Hoa Lê — Cánh cửa gỗ tự nhiên và biển gỗ khắc tên Phòng Hoa Lê',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Hoa Lê)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/hoa-le-1.jpg',
              altText: 'Phòng Hoa Lê — Giá gỗ treo khăn thổ cẩm Lô Lô và cành hoa lê trang trí',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Hoa Lê)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/hoa-le-2.jpg',
              altText: 'Phòng Hoa Lê — WC khép kín với vòi sen đồng cổ điển và bồn rửa gốm vẽ tay',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Hoa Lê)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/hoa-le-5.jpg',
              altText: 'Phòng Hoa Lê — Đĩa gỗ vẽ tay cành hoa lê trắng trên nền tường đất trình',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Hoa Lê)',
              isPrimary: false,
            },
          ],
        },
        {
          slug: 'anh-dao',
          name: 'Phòng Anh Đào',
          subtitle: 'Phòng 3 khách · 1 giường Queen & 1 giường đơn',
          description:
            'Phòng được thiết kế cho nhóm bạn ba người hoặc gia đình nhỏ với một giường đôi và một giường đơn tách biệt, trang bị đầy đủ tiện nghi giữ ấm cao nguyên đá.',
          standardCapacity: 3,
          maxCapacity: 3,
          bedConfig: 'Một giường đôi Queen Size (1,8m x 2m) + Một giường đơn (1,2m x 2m)',
          sizeSqm: 26,
          bathroomType: 'WC khép kín',
          viewType: 'Hướng mái ngói âm dương Lô Lô Chải',
          amenities: [
            'Điều hòa 2 chiều',
            'Đèn ngủ',
            'Máy sấy tóc',
            'Thiết bị vệ sinh cao cấp',
            'Đèn sưởi nhà tắm thông minh',
            'Đệm lò xo 25cm',
            'Chăn bông',
            'Khăn tắm',
            'Dép đi trong nhà',
            'Giá để đồ',
            'Móc treo quần áo',
            'Bàn trà',
          ],
          highlights: [
            'Bố cục 1 giường đôi + 1 giường đơn linh hoạt cho 3 người',
            'Đệm lò xo 25cm & chăn bông dày dặn',
            'WC khép kín có đèn sưởi thông minh',
          ],
          baseWeekdayPrice: 1_250_000,
          baseWeekendPrice: 1_450_000,
          totalUnits: 1,
          isPriceConfigured: false,
          isActive: true,
          sortOrder: 2,
          images: [
            {
              url: '/assets/img/seeme/anh-dao-1.jpg',
              altText: 'Phòng Anh Đào — Giường đôi và giường đơn ấm cúng với gối hoa văn sắc đỏ nổi bật',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Anh Đào)',
              isPrimary: true,
            },
            {
              url: '/assets/img/seeme/anh-dao-2.jpg',
              altText: 'Phòng Anh Đào — Bức tranh thổ cẩm thêu tay trang trí trên tường gỗ mộc',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Anh Đào)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/anh-dao-3.jpg',
              altText: 'Phòng Anh Đào — Cửa gỗ và biển gỗ khắc tên Phòng Anh Đào',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Anh Đào)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/anh-dao-4.jpg',
              altText: 'Phòng Anh Đào — Giá treo quần áo gỗ tự nhiên và góc phòng gọn gàng',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Anh Đào)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/anh-dao-5.jpg',
              altText: 'Phòng Anh Đào — Phòng tắm khép kín lát gạch thẻ xanh với vòi sen đồng cổ điển',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Anh Đào)',
              isPrimary: false,
            },
          ],
        },
        {
          slug: 'lo-lo-hoa',
          name: 'Phòng Lô Lô Hoa',
          subtitle: 'Phòng gia đình 4 khách · 02 giường đôi Queen Size',
          description:
            'Phòng rộng rãi cho gia đình hoặc nhóm bạn bốn người với hai giường đôi Queen Size 1,8m x 2m, ánh sáng dịu và khoảng bàn trà để cả nhóm quây quần buổi tối.',
          standardCapacity: 4,
          maxCapacity: 4,
          bedConfig: '02 giường đôi Queen Size (1,8m x 2m)',
          sizeSqm: 32,
          bathroomType: 'WC khép kín',
          viewType: 'Hướng sân nhà & triền núi Lũng Cú',
          amenities: [
            'Điều hòa 2 chiều',
            'Đèn ngủ',
            'Máy sấy tóc',
            'Thiết bị vệ sinh cao cấp',
            'Đèn sưởi nhà tắm thông minh',
            'Đệm lò xo 25cm',
            'Chăn bông',
            'Khăn tắm',
            'Dép đi trong nhà',
            'Giá để đồ',
            'Móc treo quần áo',
            'Bàn trà',
          ],
          highlights: [
            '02 giường đôi Queen Size thoải mái cho 4 người',
            'Không gian gỗ ấm áp, bàn trà riêng trong phòng',
            'Đầy đủ sưởi ấm điều hòa 2 chiều & đèn sưởi phòng tắm',
          ],
          baseWeekdayPrice: 1_550_000,
          baseWeekendPrice: 1_800_000,
          totalUnits: 1,
          isPriceConfigured: false,
          isActive: true,
          sortOrder: 3,
          images: [
            {
              url: '/assets/img/seeme/lo-lo-hoa-1.jpg',
              altText: 'Phòng Lô Lô Hoa — 02 giường đôi Queen Size ấm áp với gối họa tiết hoa và đèn ngủ gốm',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Lô Lô Hoa)',
              isPrimary: true,
            },
            {
              url: '/assets/img/seeme/lo-lo-hoa-2.jpg',
              altText: 'Phòng Lô Lô Hoa — Phòng tắm khép kín vòi sen đồng và bồn rửa gốm nghệ thuật',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Lô Lô Hoa)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/lo-lo-hoa-3.jpg',
              altText: 'Phòng Lô Lô Hoa — Khay trà gỗ và bộ chén hoa thưởng trà trong phòng',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Lô Lô Hoa)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/lo-lo-hoa-4.jpg',
              altText: 'Phòng Lô Lô Hoa — Tường trình đất trang trí vải thổ cẩm truyền thống người Lô Lô',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Lô Lô Hoa)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/lo-lo-hoa-5.jpg',
              altText: 'Phòng Lô Lô Hoa — Giá gỗ để đồ kèm dép đi trong nhà gọn gàng',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Lô Lô Hoa)',
              isPrimary: false,
            },
          ],
        },
        {
          slug: 'moc-mien',
          name: 'Phòng Mộc Miên',
          subtitle: 'Phòng lớn 6 khách · 3 giường đôi Queen & Ban công riêng',
          description:
            'Hạng phòng lớn nhất tại SEEME với ba giường đôi Queen Size, có ban công riêng, 02 máy sưởi dầu công suất ổn định và phòng tắm khép kín bồn rửa đôi tiện nghi cho đoàn 6 người.',
          standardCapacity: 6,
          maxCapacity: 6,
          bedConfig: '3 giường đôi Queen Size (1,8m x 2m)',
          sizeSqm: 44,
          bathroomType: 'WC khép kín bồn rửa đôi',
          viewType: 'Ban công hướng thôn Lô Lô Chải & núi đá',
          amenities: [
            '02 Máy sưởi dầu',
            'Ban công',
            'Đèn ngủ',
            'Máy sấy tóc',
            'Thiết bị vệ sinh cao cấp',
            'Đèn sưởi nhà tắm thông minh',
            'Đệm lò xo 25cm',
            'Chăn bông',
            'Khăn tắm',
            'Dép đi trong nhà',
            'Giá để đồ',
            'Móc treo quần áo',
            'Bàn trà',
          ],
          highlights: [
            'Ban công riêng thoáng nhìn ra bản và mây núi Lũng Cú',
            '02 máy sưởi dầu giữ hơi ấm êm dịu suốt đêm vùng cao',
            'WC khép kín rộng với bồn rửa đôi cho nhóm 6 khách',
          ],
          baseWeekdayPrice: 2_150_000,
          baseWeekendPrice: 2_450_000,
          totalUnits: 1,
          isPriceConfigured: false,
          isActive: true,
          sortOrder: 4,
          images: [
            {
              url: '/assets/img/seeme/moc-mien-1.jpg',
              altText: 'Phòng Mộc Miên — Không gian rộng rãi cho 6 khách với 3 giường đôi Queen, trần gỗ và bàn trà bệt',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Mộc Miên)',
              isPrimary: true,
            },
            {
              url: '/assets/img/seeme/moc-mien-3.jpg',
              altText: 'Phòng Mộc Miên — Hệ xà gỗ truyền thống, ánh đèn vàng ấm và ban công thoáng đãng',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Mộc Miên)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/moc-mien-4.jpg',
              altText: 'Phòng Mộc Miên — Tường trình đất nguyên bản bên các giường ngủ rộng rãi',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Mộc Miên)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/moc-mien-2.jpg',
              altText: 'Phòng Mộc Miên — WC khép kín với bồn rửa đôi gốm vẽ tay và vòi đồng tiện nghi cho đoàn 6 khách',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Mộc Miên)',
              isPrimary: false,
            },
            {
              url: '/assets/img/seeme/moc-mien-5.jpg',
              altText: 'Phòng Mộc Miên — Đèn ngủ gốm bản địa và gối thổ cẩm đầu giường',
              sourceType: 'official',
              creditText: 'SEEME Homestay Official Fanpage (Album Phòng Mộc Miên)',
              isPrimary: false,
            },
          ],
        },
      ];

      for (const r of roomsData) {
        const { images, ...roomFields } = r;
        const [insertedRoom] = await db.insert(schema.rooms).values(roomFields).returning();
        for (let idx = 0; idx < images.length; idx++) {
          await db.insert(schema.roomImages).values({
            roomId: insertedRoom.id,
            url: images[idx].url,
            altText: images[idx].altText,
            sourceType: images[idx].sourceType,
            creditText: images[idx].creditText,
            isPrimary: images[idx].isPrimary,
            sortOrder: idx,
          });
        }
      }

      // Seed Verified Experiences & Services (Food / Firepit / Motorbike matching brief + Fanpage evidence)
      await db.insert(schema.extraServices).values([
        {
          slug: 'set-lau-bo',
          name: 'Set lẩu bò ấm tại sân home',
          category: 'FOOD',
          description:
            'Nồi lẩu bò nóng hổi phục vụ buổi tối ngay tại không gian sinh hoạt chung của SEEME giữa tiết trời se lạnh Lũng Cú.',
          price: 450_000,
          unit: 'nồi (2–4 người)',
          imageUrl: '/assets/img/seeme/living-5.jpg',
          imageAlt: 'Không gian bàn trà và dùng bữa ấm cúng tại SEEME Homestay',
          sourceType: 'official',
          isAvailable: true,
          isPriceConfigured: false,
          sortOrder: 1,
        },
        {
          slug: 'bbq-ga-nuong-khoai-ngo',
          name: 'Gà nướng, BBQ & khoai ngô bên bếp lửa',
          category: 'FOOD',
          description:
            'Đặt trước phần nướng buổi tối quây quần bên bếp lửa: gà nướng bản địa, thịt xiên, khoai và ngô nướng (gồm phần bếp nướng).',
          price: 550_000,
          unit: 'set (2–4 người)',
          imageUrl: '/assets/img/seeme/space-1.jpg',
          imageAlt: 'Khoảng sân ấm ánh đèn buổi tối tại SEEME Homestay',
          sourceType: 'official',
          isAvailable: true,
          isPriceConfigured: false,
          sortOrder: 2,
        },
        {
          slug: 'than-cui-bep-lua',
          name: 'Bếp than củi & củi lửa sinh hoạt tối',
          category: 'ADDON',
          description:
            'Chuẩn bị thêm than củi đốt sưởi và nướng khoai ngô ngoài sân tối theo nhu cầu đoàn.',
          price: 120_000,
          unit: 'lần chuẩn bị',
          imageUrl: '/assets/img/seeme/living-3.jpg',
          imageAlt: 'Góc hiên gỗ sinh hoạt buổi tối tại SEEME Homestay',
          sourceType: 'official',
          isAvailable: true,
          isPriceConfigured: false,
          sortOrder: 3,
        },
        {
          slug: 'bua-sang-shan-tuyet',
          name: 'Bữa sáng & Trà sữa Shan Tuyết',
          category: 'FOOD',
          description:
            'Bữa sáng ấm phục vụ tại home kèm trà ấm hoặc trà sữa Shan Tuyết Hà Giang thơm dịu trước giờ xuất phát đi cột cờ.',
          price: 85_000,
          unit: 'người',
          imageUrl: '/assets/img/seeme/living-4.jpg',
          imageAlt: 'Góc thưởng trà ấm buổi sáng tại phòng khách SEEME Homestay',
          sourceType: 'official',
          isAvailable: true,
          isPriceConfigured: false,
          sortOrder: 4,
        },
        {
          slug: 'thue-xe-may',
          name: 'Thuê xe máy khám phá Lũng Cú – Đồng Văn',
          category: 'TRANSPORT',
          description:
            'Hỗ trợ đặt trước xe máy kiểm tra phanh và lốp kỹ cho cung đường đèo Lũng Cú, Mốc Cực Bắc, Đèo Mã Pí Lèng.',
          price: 200_000,
          unit: 'xe/ngày',
          imageUrl: '/assets/img/seeme/space-4.jpg',
          imageAlt: 'Cổng đá thôn Lô Lô Chải điểm xuất phát khám phá Lũng Cú – Đồng Văn',
          sourceType: 'official',
          isAvailable: true,
          isPriceConfigured: false,
          sortOrder: 5,
        },
      ]);

      // Seed Verified Guest Reviews (verbatim from Fanpage evidence)
      await db.insert(schema.reviews).values([
        {
          authorName: 'Thảo Nguyễn',
          sourceLabel: 'Đánh giá công khai trên Facebook Fanpage',
          sourceDate: '9 tháng 5',
          quote:
            'Home sạch sẽ, phòng ấm áp, có cả mùng ngủ. Nhân viên rất nhiệt tình và chu đáo. Mình lựa chọn ăn tối tại home luôn. Đồ ăn ngon vừa khẩu vị. Nếu có quay lại lô lô nhất định sẽ lựa chọn seemee đầu tiên ❤️ Vì đã si mê 🥰',
          isPublished: true,
          sortOrder: 1,
        },
        {
          authorName: 'Huyền Thanh Trần',
          sourceLabel: 'Đánh giá công khai trên Facebook Fanpage',
          sourceDate: '29 tháng 10, 2025',
          quote:
            'Đến 1 lần luỵ mãi, thích cái cách bài trí của home, thích cửa lối vào. Hy vọng có duyên gặp lại vào 1 ngày gần nhất.',
          isPublished: true,
          sortOrder: 2,
        },
        {
          authorName: 'Minh Giang',
          sourceLabel: 'Đánh giá công khai trên Facebook Fanpage',
          sourceDate: '10 tháng 3, 2024',
          quote:
            'Buổi tối bên bếp lửa nướng khoai ngô, ăn lẩu bò, gà nướng thật sự là trải nghiệm k thể quên khi lần đầu đi Lô lô chải lại may mắn đc ở tại Seeme homestay',
          isPublished: true,
          sortOrder: 3,
        },
        {
          authorName: 'Nguyễn Liêm',
          sourceLabel: 'Đánh giá công khai trên Facebook Fanpage',
          sourceDate: '9 tháng 5',
          quote: 'Khi có dịp nhất định sẽ quay lại Homestay SEEME này!',
          isPublished: true,
          sortOrder: 4,
        },
      ]);

      // Seed Sample Holiday & Seasonal Pricing Rule templates (for immediate verifiable demo of precedence)
      await db.insert(schema.pricingRules).values([
        {
          name: 'Kỳ nghỉ Lễ Quốc Khánh / Lễ Tết (mẫu Admin cấu hình)',
          ruleType: 'HOLIDAY',
          roomId: null,
          startDate: '2027-01-01',
          endDate: '2027-01-03',
          daysOfWeek: null,
          priceMode: 'PERCENT_MULTIPLIER',
          amount: 130,
          priority: 100,
          note: 'Áp dụng quy tắc Lễ/Tết: không hoàn tiền và không đổi ngày.',
          isActive: true,
        },
        {
          name: 'Mùa hoa Tam Giác Mạch & Mây cao nguyên',
          ruleType: 'SEASONAL',
          roomId: null,
          startDate: '2026-10-15',
          endDate: '2026-12-15',
          daysOfWeek: null,
          priceMode: 'PERCENT_MULTIPLIER',
          amount: 110,
          priority: 20,
          note: 'Phụ thu mùa cao điểm tam giác mạch (+10%).',
          isActive: true,
        },
      ]);
    })();
  }
  await seedPromise;
}

if (require.main === module) {
  ensureSeeded()
    .then(() => {
      console.log('SEEME database schema & seed ensured successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
