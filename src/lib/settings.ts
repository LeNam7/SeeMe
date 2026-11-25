import { eq } from 'drizzle-orm';
import { db, ensureDbSchema, schema, type AppDatabase } from '@/db';
import type { PolicySettingsConfig } from '@/db/schema';

export interface BrandSettingsConfig {
  name: string;
  shortName: string;
  tagline: string;
  address: string;
  subAddressNote: string;
  hotline: string;
  hotlineRaw: string;
  email: string;
  facebookUrl: string;
  zaloPhone: string;
  googleMapsUrl: string;
  googleMapsEmbedUrl: string;
}

export interface PaymentSettingsConfig {
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  template: string;
  depositRatio: number; // 1.0 = 100% per brief
}

export interface WorkflowSettingsConfig {
  mode: 'APPROVAL_FIRST' | 'INSTANT_PAYMENT';
  weekendDays: number[]; // Default [5, 6] (Friday & Saturday nights)
}

export interface ZaloSettingsConfig {
  enabled: boolean;
  oaId: string;
  ownerZaloPhone: string;
  notifyOnBookingCreated: boolean;
  notifyOnBookingApproved: boolean;
  notifyOnPaymentConfirmed: boolean;
}

export const DEFAULT_BRAND_SETTINGS: BrandSettingsConfig = {
  name: 'SEEME Homestay',
  shortName: 'SEEME (SI MÊ)',
  tagline: 'Căn nhà nhỏ xinh ở thôn Lô Lô Chải, nép mình dưới chân cột cờ Quốc Gia Lũng Cú.',
  address: 'Thôn Lô Lô Chải, Xã Lũng Cú, Đồng Văn, Hà Giang',
  subAddressNote: 'Một số bài đăng gần đây của homestay cũng ghi địa bàn Xã Lũng Cú, Tỉnh Tuyên Quang.',
  hotline: '0932.237.796',
  hotlineRaw: '0932237796',
  email: 'lienhe@seemee-homestay.example',
  facebookUrl: 'https://www.facebook.com/profile.php?id=100093359425592',
  zaloPhone: '0932237796',
  googleMapsUrl: 'https://www.google.com/maps?cid=5885041360991933450',
  googleMapsEmbedUrl:
    'https://www.google.com/maps?cid=5885041360991933450&hl=vi&z=17&output=embed',
};

export const DEFAULT_POLICY_SETTINGS: PolicySettingsConfig = {
  fullRefundDaysBefore: 7,
  partialRefundDaysBefore: 3,
  partialRefundPercent: 50,
  noRefundUnderDays: 3,
  holidayNonRefundable: true,
  groupRoomThreshold: 3,
  groupMinNoticeDays: 14,
  boundaryRuleNote:
    'Tính theo giờ nhận phòng tiêu chuẩn 14:00 (GMT+7): Từ đủ 7 ngày trở lên (>=168 giờ, bao gồm đúng mốc 7 ngày) hoàn 100% tiền phòng; Từ đủ 3 ngày đến dưới 7 ngày (từ đủ 72 giờ đến dưới 168 giờ, bao gồm đúng mốc 3 ngày) hoàn 50%; Dưới 3 ngày (<72 giờ) không hoàn tiền phòng. Ngày Lễ/Tết mất 100% và không hoàn, không đổi ngày. Nhóm từ 3 phòng trở lên hoặc đặt nguyên căn cần báo trước tối thiểu 14 ngày (cấu hình được trong khoảng 10–14 ngày).',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  holdMinutesApproval: 24 * 60,
  holdMinutesPayment: 30,
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettingsConfig = {
  bankBin: process.env.VIETQR_BANK_BIN || '970436',
  bankName: process.env.VIETQR_BANK_NAME || 'Vietcombank',
  accountNo: process.env.VIETQR_ACCOUNT_NO || '',
  accountName: process.env.VIETQR_ACCOUNT_NAME || 'SEEME HOMESTAY',
  template: process.env.VIETQR_TEMPLATE || 'compact2',
  depositRatio: 1.0,
};

export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettingsConfig = {
  mode: 'INSTANT_PAYMENT',
  weekendDays: [5, 6],
};

export const DEFAULT_ZALO_SETTINGS: ZaloSettingsConfig = {
  enabled: Boolean(process.env.ZALO_OA_ACCESS_TOKEN),
  oaId: process.env.ZALO_OA_ID || '',
  ownerZaloPhone: '0932237796',
  notifyOnBookingCreated: true,
  notifyOnBookingApproved: true,
  notifyOnPaymentConfirmed: true,
};

export interface AllSiteSettings {
  brand: BrandSettingsConfig;
  policy: PolicySettingsConfig;
  payment: PaymentSettingsConfig;
  workflow: WorkflowSettingsConfig;
  zalo: ZaloSettingsConfig;
}

export async function getAllSiteSettings(txOrDb: AppDatabase = db): Promise<AllSiteSettings> {
  await ensureDbSchema();
  const rows = await txOrDb.select().from(schema.siteSettings);
  const map = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    brand: { ...DEFAULT_BRAND_SETTINGS, ...((map.get('brand') as Partial<BrandSettingsConfig>) || {}) },
    policy: { ...DEFAULT_POLICY_SETTINGS, ...((map.get('policy') as Partial<PolicySettingsConfig>) || {}) },
    payment: { ...DEFAULT_PAYMENT_SETTINGS, ...((map.get('payment') as Partial<PaymentSettingsConfig>) || {}) },
    workflow: {
      ...DEFAULT_WORKFLOW_SETTINGS,
      ...((map.get('workflow') as Partial<WorkflowSettingsConfig>) || {}),
      mode: 'INSTANT_PAYMENT',
    },
    zalo: { ...DEFAULT_ZALO_SETTINGS, ...((map.get('zalo') as Partial<ZaloSettingsConfig>) || {}) },
  };
}

export async function updateSiteSetting<K extends keyof AllSiteSettings>(
  key: K,
  value: AllSiteSettings[K]
): Promise<AllSiteSettings[K]> {
  await ensureDbSchema();
  await db
    .insert(schema.siteSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.siteSettings.key,
      set: { value, updatedAt: new Date() },
    });
  return value;
}

export async function getSettingValue<K extends keyof AllSiteSettings>(
  key: K
): Promise<AllSiteSettings[K]> {
  const all = await getAllSiteSettings();
  return all[key];
}

export async function ensureSettingDefaultsExist(): Promise<void> {
  const entries: Array<[keyof AllSiteSettings, unknown]> = [
    ['brand', DEFAULT_BRAND_SETTINGS],
    ['policy', DEFAULT_POLICY_SETTINGS],
    ['payment', DEFAULT_PAYMENT_SETTINGS],
    ['workflow', DEFAULT_WORKFLOW_SETTINGS],
    ['zalo', DEFAULT_ZALO_SETTINGS],
  ];
  for (const [key, val] of entries) {
    const existing = await db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.key, key));
    if (existing.length === 0) {
      await db.insert(schema.siteSettings).values({ key, value: val as Record<string, unknown> });
    }
  }
}
