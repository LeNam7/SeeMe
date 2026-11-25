'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Copy,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  PhoneCall,
} from 'lucide-react';
import { formatDateVi, formatVnd } from '@/lib/dates';

interface BookingDetailPayload {
  booking: {
    id: number;
    bookingCode: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    guestsCount: number;
    roomsCount: number;
    isWholeHouse: boolean;
    roomSubtotal: number;
    servicesSubtotal: number;
    totalAmount: number;
    status: string;
    workflowMode: string;
    paymentStatus: string;
    expectedCheckInTime: string | null;
    roomPrepNotes: string | null;
    specialNotes: string | null;
    consultationTopics: string[];
    consultationQuestion: string | null;
    cancellationPolicySnapshot: {
      applicableTierLabel: string;
      summaryText: string;
    };
    holdExpiresAt: string | null;
    rejectedReason: string | null;
    createdAt: string;
  };
  items: {
    id: number;
    roomNameSnapshot: string;
    quantity: number;
    subtotal: number;
  }[];
  services: {
    id: number;
    serviceNameSnapshot: string;
    unitPrice: number;
    unit: string;
    quantity: number;
    subtotal: number;
  }[];
  payment: {
    id: number;
    amount: number;
    status: string;
    qrImageUrl: string;
    externalQrUrl: string | null;
    bankBin: string;
    bankName: string;
    accountNo: string;
    accountName: string;
    transferContent: string;
    expiresAt: string;
    paidAt: string | null;
    transactionRef: string | null;
  } | null;
  history: {
    id: number;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    actorName: string;
    note: string | null;
    createdAt: string;
  }[];
  brand: {
    name: string;
    hotline: string;
    hotlineRaw: string;
    zaloPhone: string;
  };
}

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  PENDING: {
    label: 'Đang thanh toán',
    cls: 'bg-amber-50 text-amber-900 border-amber-300',
  },
  APPROVED: {
    label: 'Đang thanh toán',
    cls: 'bg-amber-50 text-amber-900 border-amber-300',
  },
  AWAITING_PAYMENT: {
    label: 'Đang thanh toán',
    cls: 'bg-amber-50 text-amber-900 border-amber-300',
  },
  CONFIRMED: {
    label: 'Đã hoàn tất',
    cls: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  },
  REJECTED: {
    label: 'Đã hủy',
    cls: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  },
  CANCELLED: {
    label: 'Đã hủy',
    cls: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  },
  EXPIRED: {
    label: 'Hết hạn thanh toán',
    cls: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  },
};

export function BookingStatusView({ initialData }: { initialData: BookingDetailPayload }) {
  const [data, setData] = useState(initialData);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [countdownText, setCountdownText] = useState<string>('');

  const code = data.booking.bookingCode;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${code}`, { cache: 'no-store' });
      if (res.ok) {
        const next = await res.json();
        setData(next);
      }
    } catch {
      // ignore transient poll failure
    }
  }, [code]);

  useEffect(() => {
    if (!['PENDING', 'APPROVED', 'AWAITING_PAYMENT'].includes(data.booking.status)) return;
    const id = setInterval(() => void refresh(), 8000);
    return () => clearInterval(id);
  }, [data.booking.status, refresh]);

  useEffect(() => {
    const deadlineIso = data.payment?.expiresAt || data.booking.holdExpiresAt;
    if (!deadlineIso) return;
    const updateTimer = () => {
      const ms = new Date(deadlineIso).getTime() - Date.now();
      if (ms <= 0) {
        setCountdownText('Đã hết thời hạn');
        return;
      }
      const totalSec = Math.floor(ms / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      setCountdownText(
        hrs > 0 ? `${hrs} giờ ${remMins} phút` : `${remMins} phút ${String(secs).padStart(2, '0')} giây`
      );
    };
    updateTimer();
    const t = setInterval(updateTimer, 1000);
    return () => clearInterval(t);
  }, [data.payment?.expiresAt, data.booking.holdExpiresAt]);

  async function copyValue(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // ignore
    }
  }

  const badge = STATUS_BADGES[data.booking.status] || {
    label: data.booking.status,
    cls: 'bg-neutral-100 text-neutral-800',
  };

  const b = data.booking;
  const p = data.payment;
  const unconfiguredBank = p && p.accountNo.startsWith('CHUA-CAU-HINH');

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="bg-white border border-black/15 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs uppercase tracking-[0.16em] text-[#5c5750]">
              Mã đơn đặt phòng
            </span>
            <h1 className="font-display text-3xl text-[#221f1c] mt-0.5">{b.bookingCode}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${badge.cls}`}>
              {badge.label}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="p-2 rounded-lg border border-black/15 hover:bg-[#ebe3d5]"
              title="Làm mới trạng thái"
              aria-label="Làm mới trạng thái đơn"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(b.status === 'AWAITING_PAYMENT' || b.status === 'CONFIRMED') && (
          <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
            <div
              className={`p-3 rounded-lg border flex items-center gap-2 ${
                b.status === 'AWAITING_PAYMENT'
                  ? 'bg-amber-50 border-amber-300 text-amber-950 font-semibold'
                  : 'bg-[#faf7f1] border-black/10 text-[#5c5750]'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0 text-amber-700" />
              <span>1. Đang thanh toán (Tạm giữ phòng)</span>
            </div>
            <div
              className={`p-3 rounded-lg border flex items-center gap-2 ${
                b.status === 'CONFIRMED'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                  : 'bg-[#faf7f1] border-black/10 text-[#5c5750]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>2. Đã hoàn tất (Giữ phòng cố định)</span>
            </div>
          </div>
        )}

        {b.status === 'CONFIRMED' && (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700 mt-0.5" />
            <div>
              <strong>Đặt phòng đã hoàn tất!</strong>
              <p className="mt-1 text-emerald-900">
                Thanh toán {formatVnd(b.totalAmount)} đã hoàn tất
                {p?.transactionRef ? ` (Mã tham chiếu: ${p.transactionRef})` : ''}. Phòng của bạn
                đã được lưu giữ cố định trong hệ thống từ ngày {formatDateVi(b.checkInDate)} đến{' '}
                {formatDateVi(b.checkOutDate)}.
              </p>
            </div>
          </div>
        )}

        {(b.status === 'REJECTED' || b.status === 'EXPIRED' || b.status === 'CANCELLED') && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900 flex items-start gap-3">
            <XCircle className="w-5 h-5 shrink-0 text-red-700 mt-0.5" />
            <div>
              <strong>Đơn đặt phòng không còn hiệu lực giữ chỗ.</strong>
              <p className="mt-1">
                {b.rejectedReason || 'Lịch phòng đã được giải phóng tự động trên hệ thống.'} Bạn có
                thể chọn ngày khác hoặc liên hệ hotline {data.brand.hotline}.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic VietQR Payment Card */}
      {b.status === 'AWAITING_PAYMENT' && p && (
        <div className="bg-white border-2 border-[#8d3f28]/40 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-black/10">
            <div>
              <span className="seeme-badge mb-1.5">Thanh toán VietQR 100% đơn hàng</span>
              <h2 className="font-display text-2xl text-[#221f1c]">
                Quét mã chuyển khoản giữ phòng
              </h2>
            </div>
            <div className="bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg text-xs text-orange-950">
              Thời hạn thanh toán còn lại: <strong>{countdownText || '...'}</strong>
            </div>
          </div>

          {unconfiguredBank && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
              <span>
                Lưu ý vận hành: Chủ homestay chưa nhập Số tài khoản ngân hàng trong Cài đặt Admin,
                nên QR dưới đây mang mã cấu trúc tạm. Vui lòng liên hệ{' '}
                <strong>{data.brand.hotline}</strong> hoặc chờ Admin cập nhật tài khoản nhận tiền.
              </span>
            </div>
          )}

          <div className="grid md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-5 flex flex-col items-center p-4 rounded-xl bg-[#f6f1e7] border border-black/10">
              <img
                src={p.externalQrUrl || p.qrImageUrl}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== p.qrImageUrl) target.src = p.qrImageUrl;
                }}
                alt={`Mã VietQR thanh toán đơn ${b.bookingCode}`}
                className="w-60 h-60 object-contain rounded-lg bg-white p-2 border border-black/10"
              />
              <span className="text-[11px] text-[#5c5750] mt-2 text-center">
                Mã QR tự động khóa đúng số tiền {formatVnd(p.amount)} và nội dung{' '}
                <strong>{p.transferContent}</strong>
              </span>
            </div>

            <div className="md:col-span-7 space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-[#faf7f1] border border-black/10 flex justify-between items-center">
                <div>
                  <span className="text-xs text-[#5c5750] block">Ngân hàng thụ hưởng</span>
                  <strong className="text-[#221f1c]">{p.bankName}</strong>
                </div>
                <span className="text-xs text-[#5c5750]">BIN {p.bankBin || ''}</span>
              </div>

              <div className="p-3 rounded-lg bg-[#faf7f1] border border-black/10 flex justify-between items-center gap-2">
                <div>
                  <span className="text-xs text-[#5c5750] block">Số tài khoản / Chủ tài khoản</span>
                  <strong className="text-[#221f1c]">{p.accountNo}</strong> · {p.accountName}
                </div>
                <button
                  type="button"
                  onClick={() => void copyValue('stk', p.accountNo)}
                  className="text-xs px-2.5 py-1 rounded border border-black/15 bg-white hover:bg-[#ebe3d5] inline-flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedField === 'stk' ? 'Đã chép' : 'Chép'}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-[#faf7f1] border border-black/10 flex justify-between items-center gap-2">
                <div>
                  <span className="text-xs text-[#5c5750] block">Số tiền cần chuyển đúng</span>
                  <strong className="text-lg text-[#8d3f28]">{formatVnd(p.amount)}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => void copyValue('amount', String(p.amount))}
                  className="text-xs px-2.5 py-1 rounded border border-black/15 bg-white hover:bg-[#ebe3d5] inline-flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedField === 'amount' ? 'Đã chép' : 'Chép'}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-[#faf7f1] border border-[#8d3f28]/30 flex justify-between items-center gap-2">
                <div>
                  <span className="text-xs text-[#5c5750] block">Nội dung chuyển khoản bắt buộc</span>
                  <strong className="text-base text-[#221f1c]">{p.transferContent}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => void copyValue('memo', p.transferContent)}
                  className="text-xs px-2.5 py-1 rounded border border-black/15 bg-white hover:bg-[#ebe3d5] inline-flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedField === 'memo' ? 'Đã chép' : 'Chép'}
                </button>
              </div>

              <p className="text-xs text-[#5c5750] leading-relaxed pt-1">
                Hệ thống chỉ chuyển trạng thái sang <strong>Đã xác nhận</strong> sau khi cổng đối
                soát ngân hàng ghi nhận đúng số tiền và nội dung chuyển khoản, hoặc khi chủ
                homestay đối soát bút toán thực tế. Trang tự động kiểm tra lại mỗi 8 giây.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Full Booking Details Grid */}
      <div className="grid md:grid-cols-12 gap-6">
        <div className="md:col-span-7 bg-white border border-black/15 rounded-xl p-6 space-y-4 text-sm">
          <h2 className="font-display text-xl text-[#221f1c]">Chi tiết phòng & Dịch vụ</h2>

          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-black/10">
            <div>
              <span className="text-xs text-[#5c5750] block">Nhận phòng</span>
              <strong>{formatDateVi(b.checkInDate)}</strong>
            </div>
            <div>
              <span className="text-xs text-[#5c5750] block">Trả phòng</span>
              <strong>{formatDateVi(b.checkOutDate)}</strong>
            </div>
            <div>
              <span className="text-xs text-[#5c5750] block">Số đêm & Khách</span>
              <strong>
                {b.nights} đêm · {b.guestsCount} khách
              </strong>
            </div>
            <div>
              <span className="text-xs text-[#5c5750] block">Khách đặt</span>
              <strong>
                {b.customerName} ({b.customerPhone})
              </strong>
            </div>
          </div>

          <div className="space-y-2">
            {data.items.map((it) => (
              <div key={it.id} className="flex justify-between gap-4 items-baseline">
                <span>
                  {it.roomNameSnapshot} × {it.quantity} phòng
                </span>
                <strong className="shrink-0 whitespace-nowrap tabular-nums">
                  {formatVnd(it.subtotal)}
                </strong>
              </div>
            ))}
            {data.services.map((sv) => (
              <div key={sv.id} className="flex justify-between gap-4 items-baseline text-[#3c342e]">
                <span>
                  {sv.serviceNameSnapshot} × {sv.quantity} {sv.unit}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">
                  {formatVnd(sv.subtotal)}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t border-black/15 flex justify-between gap-4 items-baseline">
              <strong className="text-base">Tổng thanh toán</strong>
              <strong className="font-display text-2xl text-[#8d3f28] shrink-0 whitespace-nowrap tabular-nums">
                {formatVnd(b.totalAmount)}
              </strong>
            </div>
          </div>

          {(b.expectedCheckInTime ||
            b.roomPrepNotes ||
            b.specialNotes ||
            b.consultationTopics.length > 0 ||
            b.consultationQuestion) && (
            <div className="pt-3 border-t border-black/10 space-y-1.5 text-xs text-[#3c342e]">
              <h3 className="font-semibold text-[#221f1c] text-sm">
                Ghi chú & Yêu cầu tư vấn đã gửi:
              </h3>
              {b.expectedCheckInTime && <p>Giờ dự kiến check-in: {b.expectedCheckInTime}</p>}
              {b.roomPrepNotes && <p>Chuẩn bị phòng: {b.roomPrepNotes}</p>}
              {b.specialNotes && <p>Ghi chú khác: {b.specialNotes}</p>}
              {b.consultationTopics.length > 0 && (
                <p>Nhu cầu tư vấn: {b.consultationTopics.join(', ')}</p>
              )}
              {b.consultationQuestion && <p>Câu hỏi riêng: {b.consultationQuestion}</p>}
            </div>
          )}

          <div className="p-3 rounded-lg bg-[#ebe3d5]/60 text-xs space-y-1">
            <div className="font-semibold text-[#221f1c] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#8d3f28]" />
              Chính sách hoàn/hủy đã đồng ý:
            </div>
            <p className="text-[#8d3f28] font-medium">
              {b.cancellationPolicySnapshot.applicableTierLabel}
            </p>
            <p className="text-[#5c5750]">{b.cancellationPolicySnapshot.summaryText}</p>
          </div>
        </div>

        {/* Audit Timeline & Support */}
        <div className="md:col-span-5 space-y-5">
          <div className="bg-white border border-black/15 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-xl text-[#221f1c]">Nhật ký xử lý đơn</h2>
            <ol className="space-y-3 border-l-2 border-[#8d3f28]/30 pl-4 text-xs">
              {data.history.map((h) => (
                <li key={h.id} className="space-y-0.5">
                  <div className="font-semibold text-[#221f1c]">
                    {STATUS_BADGES[h.toStatus]?.label || h.toStatus}
                  </div>
                  {h.note && <p className="text-[#3c342e]">{h.note}</p>}
                  <span className="text-[#5c5750] block">
                    {h.actorName} · {new Date(h.createdAt).toLocaleString('vi-VN')}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-[#ebe3d5] rounded-xl p-5 space-y-3 text-sm">
            <h3 className="font-display text-lg text-[#221f1c]">Hỗ trợ nhanh từ chủ nhà</h3>
            <p className="text-xs text-[#3c342e]">
              Cần đổi giờ nhận phòng, tư vấn đường lên Lô Lô Chải hay chuẩn bị thêm đồ ăn tối?
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`tel:${data.brand.hotlineRaw}`}
                className="btn btn--primary text-xs inline-flex items-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Gọi {data.brand.hotline}
              </a>
              <a
                href={`https://zalo.me/${data.brand.zaloPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--secondary text-xs"
              >
                Nhắn Zalo SEEME
              </a>
            </div>
            <Link href="/" className="block text-xs text-[#8d3f28] underline pt-1">
              ← Quay lại trang chủ SEEME Homestay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
