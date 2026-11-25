'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Unlock, Banknote, X } from 'lucide-react';
import { addDays, formatDateVi, formatVnd, getTodayVnDate } from '@/lib/dates';

interface CalendarCell {
  date: string;
  remainingUnits: number;
  bookedUnits: number;
  blockedUnits: number;
  blockReason: string | null;
  blockNote: string | null;
  status: 'AVAILABLE' | 'PENDING' | 'CONFIRMED' | 'UNAVAILABLE';
  price: number;
  ruleType: string;
  ruleName: string;
  isHoliday: boolean;
  bookings: { id: number; code: string; status: string; customerName: string }[];
}

interface MatrixRoomRow {
  roomId: number;
  slug: string;
  name: string;
  totalUnits: number;
  dates: CalendarCell[];
}

export function AdminMatrixCalendar({
  onSelectBookingCode,
}: {
  onSelectBookingCode: (code: string) => void;
}) {
  const today = getTodayVnDate();
  const [startDate, setStartDate] = useState(today);
  const [spanDays, setSpanDays] = useState<7 | 14 | 30>(14);
  const [roomFilter, setRoomFilter] = useState<string>('ALL');
  const [rooms, setRooms] = useState<MatrixRoomRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedCell, setSelectedCell] = useState<{
    room: MatrixRoomRow;
    cell: CalendarCell;
  } | null>(null);
  const [overridePriceInput, setOverridePriceInput] = useState<string>('');
  const [blockNoteInput, setBlockNoteInput] = useState<string>('Khóa lịch trực tiếp từ Admin');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const end = addDays(startDate, spanDays);
      const q = new URLSearchParams({ start: startDate, end });
      if (roomFilter !== 'ALL') q.set('roomId', roomFilter);
      const res = await fetch(`/api/admin/calendar?${q.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setRooms(json.rooms || []);
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, spanDays, roomFilter]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  async function runCalendarAction(payload: Record<string, unknown>) {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback(json.error || 'Không thể cập nhật lịch.');
      } else {
        setFeedback('Đã cập nhật dữ liệu lịch & giá lên hệ thống.');
        await loadMatrix();
        setSelectedCell(null);
      }
    } finally {
      setSaving(false);
    }
  }

  const headerDates = rooms[0]?.dates.map((d) => d.date) || [];

  const CELL_STYLES: Record<string, string> = {
    AVAILABLE: 'bg-white border-emerald-200 hover:border-emerald-500 text-[#221f1c]',
    PENDING: 'bg-amber-50 border-amber-300 hover:border-amber-500 text-amber-950',
    CONFIRMED: 'bg-emerald-100 border-emerald-400 hover:border-emerald-700 text-emerald-950',
    UNAVAILABLE: 'bg-neutral-200 border-neutral-300 text-neutral-700',
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white rounded-xl border border-black/10 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStartDate(addDays(startDate, -spanDays))}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-black/15 hover:bg-[#ebe3d5]"
            aria-label="Khoảng trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={startDate}
            onChange={(e) => e.target.value && setStartDate(e.target.value)}
            className="seeme-input !w-auto !py-1.5 h-[40px] text-sm"
          />
          <button
            type="button"
            onClick={() => setStartDate(addDays(startDate, spanDays))}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-black/15 hover:bg-[#ebe3d5]"
            aria-label="Khoảng sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setStartDate(today)}
            className="h-[40px] text-xs font-semibold px-3.5 rounded-lg bg-[#ebe3d5] hover:bg-[#ded3bf] text-[#221f1c]"
          >
            Hôm nay
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="seeme-select !w-auto !py-1.5 !pr-8 h-[40px] text-sm leading-normal"
            aria-label="Lọc theo phòng"
          >
            <option value="ALL">Tất cả hạng phòng</option>
            {rooms.map((r) => (
              <option key={r.roomId} value={String(r.roomId)}>
                {r.name}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-lg border border-black/15 overflow-hidden text-xs h-[40px]">
            {([7, 14, 30] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSpanDays(n)}
                className={`px-3.5 h-full font-medium transition ${
                  spanDays === n ? 'bg-[#221f1c] text-[#f6f1e7]' : 'bg-white text-[#221f1c] hover:bg-[#faf7f1]'
                }`}
              >
                {n} ngày
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[#3c342e] px-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-white border border-emerald-400 inline-block" /> Còn
          trống
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-400 inline-block" /> Đang
          thanh toán (Tạm giữ)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-500 inline-block" />{' '}
          Đã hoàn tất (Giữ phòng)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-neutral-300 border border-neutral-400 inline-block" />{' '}
          Chủ nhà khóa phòng
        </span>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          {feedback}
        </div>
      )}

      {/* Interactive Matrix Table */}
      <div className="bg-white rounded-xl border border-black/10 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-[#5c5750]">Đang tải ma trận lịch phòng...</div>
        ) : (
          <table className="w-full border-collapse text-xs min-w-[720px]">
            <thead>
              <tr className="bg-[#faf7f1] border-b border-black/10">
                <th className="sticky left-0 z-10 bg-[#faf7f1] text-left px-3 py-2.5 font-semibold text-[#221f1c] border-r border-black/10 min-w-[140px]">
                  Hạng phòng
                </th>
                {headerDates.map((d) => {
                  const dt = new Date(`${d}T12:00:00Z`);
                  const dayLabel = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dt.getUTCDay()];
                  return (
                    <th
                      key={d}
                      className="px-2 py-2 font-medium text-center border-r border-black/5 min-w-[78px]"
                    >
                      <span className="block text-[10px] text-[#5c5750]">{dayLabel}</span>
                      <span className="font-semibold text-[#221f1c]">{formatDateVi(d).slice(0, 5)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.roomId} className="border-b border-black/10 last:border-b-0">
                  <td className="sticky left-0 z-10 bg-white px-3 py-3 font-medium text-[#221f1c] border-r border-black/10">
                    {room.name}
                    <span className="block text-[10px] text-[#5c5750] font-normal">
                      {room.totalUnits} phòng
                    </span>
                  </td>
                  {room.dates.map((cell) => (
                    <td key={cell.date} className="p-1 border-r border-black/5 align-top">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCell({ room, cell });
                          setOverridePriceInput(String(cell.price));
                          setBlockNoteInput(cell.blockNote || 'Chủ nhà khóa phòng trực tiếp');
                        }}
                        className={`w-full rounded-md border p-1.5 text-left transition ${
                          CELL_STYLES[cell.status]
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-[10px] truncate">
                            {cell.status === 'AVAILABLE'
                              ? 'Trống'
                              : cell.status === 'PENDING'
                                ? 'Đang TT'
                                : cell.status === 'CONFIRMED'
                                  ? 'Hoàn tất'
                                  : 'Khóa'}
                          </span>
                          {cell.ruleType === 'OVERRIDE' && (
                            <span className="text-[9px] font-bold text-[#8d3f28]">★</span>
                          )}
                          {cell.isHoliday && (
                            <span className="text-[9px] font-bold text-red-700">Lễ</span>
                          )}
                        </div>
                        <div className="text-[11px] font-medium mt-0.5">
                          {Math.round(cell.price / 1000)}k
                        </div>
                        {cell.bookings[0] && (
                          <div className="text-[9px] truncate mt-0.5 font-semibold">
                            {cell.bookings[0].customerName}
                          </div>
                        )}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cell Inspector Modal */}
      {selectedCell && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs text-[#8d3f28] font-semibold">
                  {selectedCell.room.name}
                </span>
                <h3 className="font-display text-xl text-[#221f1c]">
                  Ngày {formatDateVi(selectedCell.cell.date)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-[#faf7f1] border border-black/10 text-xs space-y-1">
              <div>
                Trạng thái hiện tại: <strong>{selectedCell.cell.status}</strong> (còn{' '}
                {selectedCell.cell.remainingUnits}/{selectedCell.room.totalUnits})
              </div>
              <div>
                Giá áp dụng: <strong>{formatVnd(selectedCell.cell.price)}</strong> (
                {selectedCell.cell.ruleName})
              </div>
            </div>

            {selectedCell.cell.bookings.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase text-[#5c5750]">
                  Đơn đặt phòng trong ngày này
                </span>
                {selectedCell.cell.bookings.map((bk) => (
                  <div
                    key={bk.id}
                    className="p-3 rounded-lg border border-black/15 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-sm block">{bk.customerName}</strong>
                      <span className="text-[#5c5750]">
                        Mã {bk.code} · {bk.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCell(null);
                        onSelectBookingCode(bk.code);
                      }}
                      className="btn btn--primary text-xs py-1.5 px-3"
                    >
                      Mở chi tiết đơn
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Lock/Unlock Day */}
            <div className="pt-3 border-t border-black/10 space-y-2">
              <span className="text-xs font-semibold uppercase text-[#5c5750] block">
                Khóa / Mở phòng thủ công
              </span>
              {selectedCell.cell.blockedUnits > 0 ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void runCalendarAction({
                      action: 'UNBLOCK_DATE',
                      roomId: selectedCell.room.roomId,
                      date: selectedCell.cell.date,
                    })
                  }
                  className="btn btn--secondary w-full justify-center flex items-center gap-2 text-sm"
                >
                  <Unlock className="w-4 h-4" /> Mở lại phòng ngày này
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={blockNoteInput}
                    onChange={(e) => setBlockNoteInput(e.target.value)}
                    placeholder="Lý do khóa phòng (khách vãng lai, bảo trì...)"
                    className="seeme-input text-xs"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void runCalendarAction({
                        action: 'BLOCK_DATE',
                        roomId: selectedCell.room.roomId,
                        date: selectedCell.cell.date,
                        reason: 'OWNER_BLOCK',
                        note: blockNoteInput,
                      })
                    }
                    className="btn btn--secondary w-full justify-center flex items-center gap-2 text-sm"
                  >
                    <Lock className="w-4 h-4" /> Khóa không cho đặt ngày này
                  </button>
                </div>
              )}
            </div>

            {/* Per-Date Price Override */}
            <div className="pt-3 border-t border-black/10 space-y-2">
              <span className="text-xs font-semibold uppercase text-[#5c5750] block">
                Điều chỉnh giá riêng ngày {formatDateVi(selectedCell.cell.date)}
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  step={10000}
                  value={overridePriceInput}
                  onChange={(e) => setOverridePriceInput(e.target.value)}
                  className="seeme-input text-sm"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void runCalendarAction({
                      action: 'PRICE_OVERRIDE',
                      roomId: selectedCell.room.roomId,
                      date: selectedCell.cell.date,
                      overridePrice: Number(overridePriceInput),
                    })
                  }
                  className="btn btn--primary text-xs shrink-0 inline-flex items-center gap-1"
                >
                  <Banknote className="w-4 h-4" /> Lưu giá
                </button>
              </div>
              {selectedCell.cell.ruleType === 'OVERRIDE' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void runCalendarAction({
                      action: 'CLEAR_PRICE_OVERRIDE',
                      roomId: selectedCell.room.roomId,
                      date: selectedCell.cell.date,
                    })
                  }
                  className="text-xs text-[#8d3f28] underline"
                >
                  Gỡ giá chỉnh tay (về giá theo quy tắc)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
