import { eq } from 'drizzle-orm';
import { db, ensureDbSchema, schema } from '@/db';
import { formatDateVi, formatVnd } from './dates';
import { getAllSiteSettings } from './settings';

export type ZaloEventType =
  | 'BOOKING_CREATED_OWNER'
  | 'BOOKING_CREATED_GUEST'
  | 'BOOKING_APPROVED_GUEST'
  | 'BOOKING_REJECTED_GUEST'
  | 'PAYMENT_CONFIRMED_GUEST'
  | 'PAYMENT_CONFIRMED_OWNER';

export interface DispatchZaloParams {
  bookingId: number;
  bookingCode: string;
  eventType: ZaloEventType;
  customerName: string;
  customerPhone: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  roomsSummary: string;
  note?: string;
}

export function buildZaloDirectChatUrl(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  const normalized = digits.startsWith('84')
    ? `0${digits.slice(2)}`
    : digits.startsWith('0')
      ? digits
      : digits;
  return `https://zalo.me/${normalized}`;
}

export async function dispatchZaloNotification(params: DispatchZaloParams) {
  await ensureDbSchema();
  const settings = await getAllSiteSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const accessToken = process.env.ZALO_OA_ACCESS_TOKEN?.trim() || '';
  const ownerUserId = process.env.ZALO_OWNER_USER_ID?.trim() || '';
  const ownerPhone = settings.zalo.ownerZaloPhone || settings.brand.zaloPhone;

  const isOwnerEvent = params.eventType.endsWith('_OWNER');
  const recipient = isOwnerEvent ? ownerPhone : params.customerPhone;
  const bookingUrl = `${siteUrl}/booking/${params.bookingCode}`;
  const adminUrl = `${siteUrl}/admin?booking=${params.bookingCode}`;

  const messageText =
    params.eventType === 'BOOKING_CREATED_OWNER'
      ? `[SEEME] Đơn mới ${params.bookingCode}: ${params.customerName} (${params.customerPhone}), ${params.roomsSummary}, ${formatDateVi(
          params.checkInDate
        )} - ${formatDateVi(params.checkOutDate)}, tổng ${formatVnd(params.totalAmount)}. Xem Admin: ${adminUrl}`
      : params.eventType === 'BOOKING_APPROVED_GUEST'
        ? `SEEME Homestay đã xác nhận giữ phòng cho mã đơn ${params.bookingCode}. Vui lòng thanh toán VietQR tại: ${bookingUrl}`
        : params.eventType === 'BOOKING_REJECTED_GUEST'
          ? `Rất tiếc, đơn ${params.bookingCode} không thể phục vụ trong thời gian đã chọn. ${params.note || ''} Chi tiết: ${bookingUrl}`
          : params.eventType === 'PAYMENT_CONFIRMED_GUEST'
            ? `SEEME Homestay đã nhận thanh toán ${formatVnd(params.totalAmount)} cho mã đơn ${params.bookingCode}. Hẹn đón bạn tại Lô Lô Chải!`
            : `[SEEME] Khách ${params.customerName} (${params.bookingCode}) - ${formatVnd(params.totalAmount)} (${params.eventType})`;

  const payloadObj = {
    bookingCode: params.bookingCode,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    totalAmount: params.totalAmount,
    roomsSummary: params.roomsSummary,
    bookingUrl,
    adminUrl,
    zaloDirectLink: buildZaloDirectChatUrl(recipient),
    messageText,
  };

  const [createdLog] = await db
    .insert(schema.notificationLogs)
    .values({
      bookingId: params.bookingId,
      channel: isOwnerEvent ? 'ZALO_OA' : 'ZALO_ZNS',
      eventType: params.eventType,
      recipient,
      payload: payloadObj,
      status: accessToken ? 'UNSENT' : 'PENDING_CONFIG',
      errorMessage: accessToken
        ? null
        : 'Chưa cấu hình ZALO_OA_ACCESS_TOKEN. Nhật ký đã lưu để nhân viên liên hệ qua Zalo cá nhân hoặc kích hoạt OA.',
    })
    .returning();

  if (!accessToken) {
    return createdLog;
  }

  // Real Zalo OA / ZNS HTTP adapter when credentials are configured
  try {
    const endpoint =
      isOwnerEvent && ownerUserId
        ? 'https://openapi.zalo.me/v3.0/oa/message/cs'
        : 'https://business.openapi.zalo.me/message/template';

    const body =
      isOwnerEvent && ownerUserId
        ? {
            recipient: { user_id: ownerUserId },
            message: { text: messageText },
          }
        : {
            phone: recipient.replace(/^0/, '84'),
            template_id:
              process.env.ZALO_TEMPLATE_BOOKING_CREATED ||
              process.env.ZALO_TEMPLATE_BOOKING_APPROVED ||
              '',
            template_data: {
              booking_code: params.bookingCode,
              customer_name: params.customerName,
              check_in: formatDateVi(params.checkInDate),
              check_out: formatDateVi(params.checkOutDate),
              total_amount: String(params.totalAmount),
            },
            tracking_id: `${params.bookingCode}-${params.eventType}`,
          };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: accessToken,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: number;
      message?: string;
      data?: { msg_id?: string; message_id?: string };
    };

    const ok = res.ok && (data.error === undefined || data.error === 0);
    const [updated] = await db
      .update(schema.notificationLogs)
      .set({
        status: ok ? 'SENT' : 'FAILED',
        providerMessageId: data?.data?.msg_id || data?.data?.message_id || null,
        errorMessage: ok ? null : `Zalo API HTTP ${res.status}: ${data.message || JSON.stringify(data)}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.notificationLogs.id, createdLog.id))
      .returning();

    return updated;
  } catch (err) {
    const [updated] = await db
      .update(schema.notificationLogs)
      .set({
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Zalo network request failed',
        updatedAt: new Date(),
      })
      .where(eq(schema.notificationLogs.id, createdLog.id))
      .returning();
    return updated;
  }
}

export async function retryZaloNotification(logId: number) {
  await ensureDbSchema();
  const [log] = await db
    .select()
    .from(schema.notificationLogs)
    .where(eq(schema.notificationLogs.id, logId));
  if (!log) return null;

  const p = log.payload as Record<string, unknown>;
  if (!log.bookingId) return log;

  const accessToken = process.env.ZALO_OA_ACCESS_TOKEN?.trim() || '';
  if (!accessToken) {
    const [updated] = await db
      .update(schema.notificationLogs)
      .set({
        retryCount: log.retryCount + 1,
        status: 'PENDING_CONFIG',
        errorMessage:
          'Vẫn chưa cấu hình ZALO_OA_ACCESS_TOKEN trong môi trường máy chủ (.env). Dùng liên kết Zalo cá nhân để nhắn khách ngay.',
        updatedAt: new Date(),
      })
      .where(eq(schema.notificationLogs.id, logId))
      .returning();
    return updated;
  }

  const nextLog = await dispatchZaloNotification({
    bookingId: log.bookingId,
    bookingCode: String(p.bookingCode || ''),
    eventType: log.eventType as ZaloEventType,
    customerName: String(p.customerName || ''),
    customerPhone: String(p.customerPhone || ''),
    checkInDate: String(p.checkInDate || ''),
    checkOutDate: String(p.checkOutDate || ''),
    totalAmount: Number(p.totalAmount || 0),
    roomsSummary: String(p.roomsSummary || ''),
  });
  return nextLog;
}
