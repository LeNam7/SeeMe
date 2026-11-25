'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { addDays, formatDateVi, formatVnd, getTodayVnDate } from '@/lib/dates';
import type { CancellationPolicySnapshot, PolicySettingsConfig } from '@/db/schema';
import { GuestStepperInput } from '@/components/GuestStepperInput';
import { DateRangePicker } from '@/components/DateRangePicker';

export interface BookableRoomItem {
  id: number;
  slug: string;
  name: string;
  subtitle: string;
  standardCapacity: number;
  maxCapacity: number;
  totalUnits: number;
  baseWeekdayPrice: number;
  baseWeekendPrice: number;
}

export interface BookableServiceItem {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  unit: string;
  imageUrl: string;
  imageAlt: string;
  isAvailable: boolean;
}

interface QuoteResult {
  checkInDate: string;
  checkOutDate: string;
  nightsCount: number;
  guestsCount: number;
  roomsCount: number;
  isWholeHouse: boolean;
  roomSubtotal: number;
  servicesSubtotal: number;
  totalAmount: number;
  items: {
    roomId: number;
    roomName: string;
    quantity: number;
    nightlyBreakdown: {
      date: string;
      price: number;
      ruleName: string;
      ruleType: string;
      isHoliday: boolean;
    }[];
    unitSubtotal: number;
    subtotal: number;
  }[];
  services: {
    serviceId: number;
    name: string;
    unit: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }[];
  policySnapshot: CancellationPolicySnapshot;
  workflowMode: 'APPROVAL_FIRST' | 'INSTANT_PAYMENT';
}

const CONSULTATION_OPTIONS = [
  'Thuê xe máy',
  'Xe đưa đón (Hà Giang / Đồng Văn)',
  'Tư vấn lịch trình Lũng Cú – Mốc Cực Bắc',
  'Đặt ăn tối / tiệc bếp lửa riêng cho đoàn',
];

export function RoomBookingWidget({
  rooms,
  services,
  policyConfig,
  initialRoomId,
  initialCheckIn,
  initialCheckOut,
  initialGuests = 2,
  allowMultiRoom = false,
}: {
  rooms: BookableRoomItem[];
  services: BookableServiceItem[];
  policyConfig: PolicySettingsConfig;
  initialRoomId?: number;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  allowMultiRoom?: boolean;
}) {
  const router = useRouter();
  const today = getTodayVnDate();

  const [checkInDate, setCheckInDate] = useState(
    initialCheckIn && initialCheckIn >= today ? initialCheckIn : addDays(today, 2)
  );
  const [checkOutDate, setCheckOutDate] = useState(
    initialCheckOut && initialCheckOut > (initialCheckIn || today)
      ? initialCheckOut
      : addDays(initialCheckIn || addDays(today, 2), 1)
  );
  const [guestsCount, setGuestsCount] = useState(initialGuests);

  const [roomQuantities, setRoomQuantities] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    if (initialRoomId) {
      map[initialRoomId] = 1;
    } else if (rooms.length > 0) {
      map[rooms[0].id] = 1;
    }
    return map;
  });

  const [serviceQuantities, setServiceQuantities] = useState<Record<number, number>>({});
  const [availabilityMap, setAvailabilityMap] = useState<Record<number, number>>({});
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [expectedCheckInTime, setExpectedCheckInTime] = useState('14:00');
  const [roomPrepNotes, setRoomPrepNotes] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [consultationTopics, setConsultationTopics] = useState<string[]>([]);
  const [consultationQuestion, setConsultationQuestion] = useState('');
  const [policyAgreed, setPolicyAgreed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedRoomList = useMemo(
    () =>
      Object.entries(roomQuantities)
        .filter(([, q]) => q > 0)
        .map(([id, quantity]) => ({ roomId: Number(id), quantity })),
    [roomQuantities]
  );

  const selectedServiceList = useMemo(
    () =>
      Object.entries(serviceQuantities)
        .filter(([, q]) => q > 0)
        .map(([id, quantity]) => ({ serviceId: Number(id), quantity })),
    [serviceQuantities]
  );

  // Fetch live availability + server-computed quote whenever selection changes
  useEffect(() => {
    let cancelled = false;
    async function refreshQuote() {
      if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
        setQuoteError('Ngày trả phòng phải sau ngày nhận phòng.');
        setQuote(null);
        return;
      }
      if (selectedRoomList.length === 0) {
        setQuoteError('Vui lòng chọn ít nhất một phòng.');
        setQuote(null);
        return;
      }

      const totalSelectedMaxCapacity = selectedRoomList.reduce((sum, item) => {
        const room = rooms.find((r) => r.id === item.roomId);
        return sum + (room?.maxCapacity ?? 0) * item.quantity;
      }, 0);

      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const avRes = await fetch(`/api/availability?checkIn=${checkInDate}&checkOut=${checkOutDate}`);
        if (avRes.ok) {
          const avJson = await avRes.json();
          if (!cancelled && Array.isArray(avJson.rooms)) {
            const nextAv: Record<number, number> = {};
            for (const r of avJson.rooms) {
              nextAv[r.roomId] = r.availableUnitsForStay;
            }
            setAvailabilityMap(nextAv);
          }
        }

        if (guestsCount > totalSelectedMaxCapacity) {
          if (!cancelled) {
            setQuoteError(
              `Số khách (${guestsCount}) vượt quá sức chứa tối đa (${totalSelectedMaxCapacity} khách) của các phòng đã chọn. Vui lòng tăng thêm phòng bên dưới.`
            );
            setQuote(null);
          }
          return;
        }

        const qRes = await fetch('/api/pricing/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkInDate,
            checkOutDate,
            guestsCount,
            roomSelections: selectedRoomList,
            serviceSelections: selectedServiceList,
          }),
        });
        const qJson = await qRes.json();
        if (!cancelled) {
          if (!qRes.ok) {
            setQuoteError(qJson.error || 'Phòng không khả dụng cho lựa chọn hiện tại.');
            setQuote(null);
          } else {
            setQuote(qJson);
            setQuoteError(null);
          }
        }
      } catch {
        if (!cancelled) setQuoteError('Không thể kết nối máy chủ tính giá.');
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }
    void refreshQuote();
    return () => {
      cancelled = true;
    };
  }, [checkInDate, checkOutDate, guestsCount, selectedRoomList, selectedServiceList]);

  function toggleConsultation(topic: string) {
    setConsultationTopics((prev) =>
      prev.includes(topic) ? prev.filter((x) => x !== topic) : [...prev, topic]
    );
  }

  function selectWholeHouse() {
    const next: Record<number, number> = {};
    for (const r of rooms) {
      if ((availabilityMap[r.id] ?? r.totalUnits) > 0) {
        next[r.id] = 1;
      }
    }
    setRoomQuantities(next);
    const sumCap = rooms.reduce((s, r) => s + r.standardCapacity, 0);
    if (guestsCount < sumCap) setGuestsCount(Math.min(sumCap, 15));
  }

  async function handleSubmitBooking(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!policyAgreed) {
      setSubmitError(
        'Bạn cần tích đồng ý với "Tôi đồng ý với chính sách hoàn/hủy/đổi phòng của Homestay." trước khi tiếp tục.'
      );
      return;
    }
    if (!customerName.trim() || customerPhone.trim().length < 9) {
      setSubmitError('Vui lòng nhập đầy đủ Họ và tên và Số điện thoại (tối thiểu 9 chữ số).');
      return;
    }
    if (quoteError || !quote) {
      setSubmitError(quoteError || 'Vui lòng chọn ngày và phòng còn trống.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInDate,
          checkOutDate,
          guestsCount,
          roomSelections: selectedRoomList,
          serviceSelections: selectedServiceList,
          customerName,
          customerPhone,
          customerEmail,
          expectedCheckInTime,
          roomPrepNotes,
          specialNotes,
          consultationTopics,
          consultationQuestion,
          cancellationPolicyAgreed: policyAgreed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Đặt phòng thất bại, vui lòng kiểm tra lại.');
        return;
      }
      router.push(`/booking/${data.booking.bookingCode}`);
    } catch {
      setSubmitError('Lỗi kết nối khi gửi yêu cầu đặt phòng.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmitBooking} className="space-y-6">
      {/* 1. Dates, Guests, Room Selection */}
      <div className="bg-white border border-black/15 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xl text-[#221f1c] flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#8d3f28]" />
            Chọn lịch & số lượng khách
          </h3>
          {allowMultiRoom && (
            <button
              type="button"
              onClick={selectWholeHouse}
              className="text-xs font-semibold px-3 py-1.5 rounded bg-[#ebe3d5] hover:bg-[#e1d5c1] text-[#221f1c]"
            >
              Chọn trọn 4 phòng (Nguyên căn)
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1 min-w-0">
            <label htmlFor="booking-dates" className="block text-xs font-semibold uppercase tracking-wider text-[#5c5750] mb-1">
              Ngày lưu trú (nhấn để chọn trên lịch)
            </label>
            <DateRangePicker
              id="booking-dates"
              checkIn={checkInDate}
              checkOut={checkOutDate}
              minDate={today}
              onChange={(nextIn, nextOut) => {
                setCheckInDate(nextIn);
                setCheckOutDate(nextOut);
              }}
            />
          </div>
          <div className="w-full sm:w-48 shrink-0">
            <label htmlFor="booking-guests" className="block text-xs font-semibold uppercase tracking-wider text-[#5c5750] mb-1">
              Số lượng khách
            </label>
            <GuestStepperInput
              id="booking-guests"
              value={guestsCount}
              onChange={setGuestsCount}
              min={1}
              max={30}
            />
          </div>
        </div>

        {/* Room Qty rows */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#5c5750]">
            <span>Chọn phòng (tình trạng trống cập nhật từ CSDL)</span>
            {!allowMultiRoom && rooms.length > 1 && (
              <Link
                href={`/book?checkIn=${checkInDate}&checkOut=${checkOutDate}&guests=${guestsCount}`}
                className="text-[#8d3f28] hover:underline normal-case font-medium"
              >
                Hoặc ghép nhiều phòng / đặt nguyên căn →
              </Link>
            )}
          </div>

          {rooms
            .filter((r) => allowMultiRoom || r.id === initialRoomId || selectedRoomList.some((x) => x.roomId === r.id))
            .map((r) => {
              const qty = roomQuantities[r.id] || 0;
              const maxAvail = availabilityMap[r.id] ?? r.totalUnits;
              return (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-black/10 bg-[#faf7f1]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#221f1c]">{r.name}</span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          maxAvail > 0
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-red-100 text-red-900'
                        }`}
                      >
                        {maxAvail > 0 ? `Còn ${maxAvail} phòng` : 'Hết phòng'}
                      </span>
                    </div>
                    <p className="text-xs text-[#5c5750] mt-0.5">
                      {r.subtitle} · Tham khảo {formatVnd(r.baseWeekdayPrice)}/đêm
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() =>
                        setRoomQuantities((prev) => ({
                          ...prev,
                          [r.id]: Math.max(0, (prev[r.id] || 0) - 1),
                        }))
                      }
                      disabled={qty <= 0}
                      className="w-8 h-8 rounded border border-black/20 flex items-center justify-center bg-white disabled:opacity-40"
                      aria-label={`Giảm số lượng ${r.name}`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-7 text-center font-semibold text-sm">{qty}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setRoomQuantities((prev) => ({
                          ...prev,
                          [r.id]: Math.min(maxAvail, (prev[r.id] || 0) + 1),
                        }))
                      }
                      disabled={qty >= maxAvail}
                      className="w-8 h-8 rounded border border-black/20 flex items-center justify-center bg-white disabled:opacity-40"
                      aria-label={`Tăng số lượng ${r.name}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        {quoteError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{quoteError}</span>
          </div>
        )}
      </div>

      {/* 2. Extra Services Calculator */}
      <div className="bg-white border border-black/15 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-display text-xl text-[#221f1c] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#8d3f28]" />
            Dịch vụ bổ sung tại SEEME
          </h3>
          <p className="text-xs text-[#5c5750] mt-1">
            Lẩu bò, gà nướng bếp lửa, than củi, bữa sáng Shan Tuyết hay thuê xe máy — chi phí được
            cộng tự động theo công thức Tổng tiền = Tiền phòng + Dịch vụ bổ sung.
          </p>
        </div>

        <div className="space-y-2.5">
          {services.map((svc) => {
            const qty = serviceQuantities[svc.id] || 0;
            return (
              <div
                key={svc.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-black/10 bg-[#faf7f1]"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={svc.imageUrl}
                    alt={svc.imageAlt}
                    className="w-14 h-14 rounded-md object-cover shrink-0 bg-[#ebe3d5]"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-[#221f1c]">{svc.name}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          svc.isAvailable
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-neutral-200 text-neutral-600'
                        }`}
                      >
                        {svc.isAvailable ? 'Sẵn sàng' : 'Tạm ngưng'}
                      </span>
                    </div>
                    <p className="text-xs text-[#5c5750] mt-0.5">{svc.description}</p>
                    <p className="text-xs font-semibold text-[#8d3f28] mt-1">
                      {formatVnd(svc.price)} / {svc.unit}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    disabled={!svc.isAvailable || qty <= 0}
                    onClick={() =>
                      setServiceQuantities((prev) => ({
                        ...prev,
                        [svc.id]: Math.max(0, (prev[svc.id] || 0) - 1),
                      }))
                    }
                    className="w-8 h-8 rounded border border-black/20 flex items-center justify-center bg-white disabled:opacity-40"
                    aria-label={`Giảm ${svc.name}`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-7 text-center font-semibold text-sm">{qty}</span>
                  <button
                    type="button"
                    disabled={!svc.isAvailable}
                    onClick={() =>
                      setServiceQuantities((prev) => ({
                        ...prev,
                        [svc.id]: (prev[svc.id] || 0) + 1,
                      }))
                    }
                    className="w-8 h-8 rounded border border-black/20 flex items-center justify-center bg-white disabled:opacity-40"
                    aria-label={`Thêm ${svc.name}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Customer Info + Special Notes + Consultation */}
      <div className="bg-white border border-black/15 rounded-xl p-5 space-y-4">
        <h3 className="font-display text-xl text-[#221f1c]">Thông tin khách hàng & Yêu cầu riêng</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#5c5750] mb-1">
              Họ và tên *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Minh Anh"
              className="seeme-input"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5c5750] mb-1">
              Số điện thoại / Zalo *
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Ví dụ: 0912345678"
              className="seeme-input"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5c5750] mb-1">
              Email nhận xác nhận (tuỳ chọn)
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="email@domain.com"
              className="seeme-input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5c5750] mb-1">
              Giờ dự kiến check-in
            </label>
            <input
              type="text"
              value={expectedCheckInTime}
              onChange={(e) => setExpectedCheckInTime(e.target.value)}
              placeholder="Ví dụ: 14:30 hoặc Tối muộn 20:00"
              className="seeme-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#5c5750] mb-1">
              Yêu cầu chuẩn bị phòng
            </label>
            <input
              type="text"
              value={roomPrepNotes}
              onChange={(e) => setRoomPrepNotes(e.target.value)}
              placeholder="Ví dụ: Thêm chăn ấm, chuẩn bị ấm trà nóng"
              className="seeme-input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5c5750] mb-1">
              Ghi chú đặc biệt khác
            </label>
            <input
              type="text"
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="Ví dụ: Dị ứng thực phẩm, có trẻ nhỏ"
              className="seeme-input"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-black/10 space-y-2.5">
          <span className="block text-xs font-semibold uppercase tracking-wider text-[#5c5750]">
            Khu vực yêu cầu tư vấn riêng (lưu vào đơn để nhân viên liên hệ chủ động)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CONSULTATION_OPTIONS.map((topic) => (
              <label
                key={topic}
                className="flex items-center gap-2 text-sm text-[#221f1c] bg-[#faf7f1] px-3 py-2 rounded border border-black/10 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={consultationTopics.includes(topic)}
                  onChange={() => toggleConsultation(topic)}
                  className="accent-[#8d3f28] w-4 h-4"
                />
                <span>{topic}</span>
              </label>
            ))}
          </div>
          <textarea
            rows={2}
            value={consultationQuestion}
            onChange={(e) => setConsultationQuestion(e.target.value)}
            placeholder="Nhập câu hỏi riêng về cung đường, điểm ăn uống, đặt xe khứ hồi..."
            className="seeme-textarea"
          />
        </div>
      </div>

      {/* 4. Booking Summary & Dynamic Cancellation Policy */}
      <div className="bg-[#faf7f1] border border-[#8d3f28]/30 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-[#221f1c]">Tóm tắt đơn đặt phòng</h3>
          {quoteLoading && <span className="text-xs text-[#5c5750]">Đang tính lại...</span>}
        </div>

        {quote ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 pb-3 border-b border-black/10">
              <div>
                <span className="text-xs text-[#5c5750] block">Nhận phòng</span>
                <strong>{formatDateVi(quote.checkInDate)}</strong> (từ {policyConfig.checkInTime})
              </div>
              <div>
                <span className="text-xs text-[#5c5750] block">Trả phòng</span>
                <strong>{formatDateVi(quote.checkOutDate)}</strong> (trước {policyConfig.checkOutTime})
              </div>
              <div>
                <span className="text-xs text-[#5c5750] block">Thời gian</span>
                <strong>{quote.nightsCount} đêm</strong> · {quote.guestsCount} khách
              </div>
              <div>
                <span className="text-xs text-[#5c5750] block">Quy mô phòng</span>
                <strong>
                  {quote.roomsCount} phòng {quote.isWholeHouse ? '(Nguyên căn)' : ''}
                </strong>
              </div>
            </div>

            {/* Room items breakdown */}
            <div className="space-y-2 pb-3 border-b border-black/10">
              {quote.items.map((it) => (
                <div key={it.roomId} className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>
                      {it.roomName} × {it.quantity} phòng ({quote.nightsCount} đêm)
                    </span>
                    <span>{formatVnd(it.subtotal)}</span>
                  </div>
                  <div className="pl-3 space-y-0.5 text-xs text-[#5c5750]">
                    {it.nightlyBreakdown.map((nb) => (
                      <div key={nb.date} className="flex justify-between">
                        <span>
                          Đêm {formatDateVi(nb.date)} ({nb.ruleName})
                        </span>
                        <span>{formatVnd(nb.price * it.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {quote.services.length > 0 && (
                <div className="pt-2 border-t border-black/5 space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#5c5750] block">
                    Dịch vụ bổ sung
                  </span>
                  {quote.services.map((sv) => (
                    <div key={sv.serviceId} className="flex justify-between text-xs">
                      <span>
                        {sv.name} × {sv.quantity} {sv.unit}
                      </span>
                      <span className="font-medium">{formatVnd(sv.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#5c5750]">
                <span>Tiền phòng</span>
                <span>{formatVnd(quote.roomSubtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#5c5750]">
                <span>Dịch vụ bổ sung</span>
                <span>{formatVnd(quote.servicesSubtotal)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-black/15">
                <span className="font-semibold text-base text-[#221f1c]">
                  Tổng cộng (Thanh toán 100% VietQR)
                </span>
                <span className="font-display text-2xl font-semibold text-[#8d3f28]">
                  {formatVnd(quote.totalAmount)}
                </span>
              </div>
            </div>

            {/* Policy Card rendered from Admin settings */}
            <div className="p-3.5 rounded-lg bg-[#ebe3d5]/65 border border-black/10 space-y-2 text-xs">
              <div className="font-semibold text-[#221f1c] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#8d3f28]" />
                Chính sách hoàn / hủy / đổi phòng áp dụng cho đơn này:
              </div>
              <p className="font-medium text-[#8d3f28]">
                {quote.policySnapshot.applicableTierLabel}
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[#3c342e]">
                <li>
                  Hủy/Đổi từ đủ {policyConfig.fullRefundDaysBefore} ngày trở lên trước check-in: Hoàn
                  100% tiền phòng.
                </li>
                <li>
                  Hủy/Đổi từ đủ {policyConfig.partialRefundDaysBefore} ngày đến dưới{' '}
                  {policyConfig.fullRefundDaysBefore} ngày: Hoàn {policyConfig.partialRefundPercent}
                  % tiền phòng.
                </li>
                <li>
                  Hủy/Đổi trong vòng dưới {policyConfig.noRefundUnderDays} ngày: Không hoàn tiền
                  phòng.
                </li>
                <li>Lễ/Tết: Mất 100% tiền phòng, không hoàn và không đổi ngày.</li>
                <li>
                  Khách đặt từ {policyConfig.groupRoomThreshold} phòng trở lên hoặc nguyên căn: Báo
                  hủy/đổi trước tối thiểu {policyConfig.groupMinNoticeDays} ngày.
                </li>
              </ul>
              <p className="text-[11px] text-[#5c5750]">{policyConfig.boundaryRuleNote}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#5c5750]">
            Chọn ngày nhận phòng và số phòng hợp lệ để xem báo giá chi tiết.
          </p>
        )}

        <label className="flex items-start gap-2.5 text-sm text-[#221f1c] cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={policyAgreed}
            onChange={(e) => setPolicyAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#8d3f28]"
          />
          <span>Tôi đồng ý với chính sách hoàn/hủy/đổi phòng của Homestay.</span>
        </label>

        {submitError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || quoteLoading || !quote}
          className="btn btn--primary w-full py-3 text-base font-medium justify-center flex items-center gap-2 disabled:opacity-50"
        >
          <CheckCircle2 className="w-5 h-5" />
          {submitting
            ? 'Đang tạo đơn đặt phòng...'
            : 'Đặt phòng & Thanh toán VietQR'}
        </button>

        <p className="text-xs text-center text-[#5c5750]">
          Phòng được tạm giữ ngay trong thời gian thanh toán VietQR và lưu cố định trong hệ thống
          ngay khi hoàn tất.
        </p>
      </div>
    </form>
  );
}
