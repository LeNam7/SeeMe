'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, formatDateVi, getTodayVnDate } from '@/lib/dates';

interface DateRangePickerProps {
  id: string;
  checkIn: string;
  checkOut: string;
  minDate?: string;
  onChange: (nextCheckIn: string, nextCheckOut: string) => void;
  className?: string;
}

const WEEKDAYS_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return {
    year: Number.isFinite(y) ? y : 2026,
    month: Number.isFinite(m) ? m : 1,
    day: Number.isFinite(d) ? d : 1,
  };
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function diffNights(checkIn: string, checkOut: string): number {
  const a = parseYmd(checkIn);
  const b = parseYmd(checkOut);
  const diffMs = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.max(1, Math.round(diffMs / 86_400_000));
}

/**
 * Click-to-pick calendar range selector:
 * - Click 1 date -> selects a 1-day stay (displays ONLY the check-in date; checkOut = checkIn + 1).
 * - Click a later date -> expands to a multi-day stay (displays checkIn -> checkOut).
 */
export function DateRangePicker({
  id,
  checkIn,
  checkOut,
  minDate,
  onChange,
  className = '',
}: DateRangePickerProps) {
  const floorDate = minDate || getTodayVnDate();
  const initialParsed = parseYmd(checkIn || floorDate);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'pick_end'>('idle');
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(initialParsed.year);
  const [viewMonth, setViewMonth] = useState(initialParsed.month);
  const containerRef = useRef<HTMLDivElement>(null);

  const nights = diffNights(checkIn, checkOut);
  const isSingleDay = nights <= 1;

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPhase('idle');
        setHoverDate(null);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setPhase('idle');
        setHoverDate(null);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  function toggleOpen() {
    if (!open) {
      const p = parseYmd(checkIn || floorDate);
      setViewYear(p.year);
      setViewMonth(p.month);
      setPhase('idle');
      setHoverDate(null);
      setOpen(true);
    } else {
      setOpen(false);
      setPhase('idle');
      setHoverDate(null);
    }
  }

  function shiftMonth(delta: number) {
    const dt = new Date(Date.UTC(viewYear, viewMonth - 1 + delta, 1));
    setViewYear(dt.getUTCFullYear());
    setViewMonth(dt.getUTCMonth() + 1);
  }

  function handleDayClick(ymd: string) {
    if (ymd < floorDate) return;

    if (phase === 'idle') {
      // First click: pick single stay date (displays only check-in date), stay open in case user picks checkout date
      onChange(ymd, addDays(ymd, 1));
      setPhase('pick_end');
      setHoverDate(null);
      return;
    }

    // Second click while picking end date
    if (ymd > checkIn) {
      onChange(checkIn, ymd);
      setPhase('idle');
      setHoverDate(null);
      setOpen(false);
    } else if (ymd === checkIn) {
      // Confirm 1-day stay
      onChange(checkIn, addDays(checkIn, 1));
      setPhase('idle');
      setHoverDate(null);
      setOpen(false);
    } else {
      // Clicked earlier date -> reset start date and allow choosing checkout
      onChange(ymd, addDays(ymd, 1));
      setPhase('pick_end');
      setHoverDate(null);
    }
  }

  const calendarCells = useMemo(() => {
    const firstDow = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
    const mondayOffset = (firstDow + 6) % 7; // 0=Mon..6=Sun
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

    const cells: Array<{ ymd: string; day: number } | null> = [];
    for (let i = 0; i < mondayOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ ymd: toYmd(viewYear, viewMonth, d), day: d });
    }
    return cells;
  }, [viewYear, viewMonth]);

  // Effective highlight end date:
  // - While picking checkout date and hovering a later day, preview the range up to hoverDate.
  // - For a confirmed multi-day stay (nights > 1), highlight checkIn..checkOut.
  // - For a 1-day stay (nights === 1), highlight ONLY checkIn cleanly.
  const previewEnd =
    phase === 'pick_end' && hoverDate && hoverDate > checkIn
      ? hoverDate
      : !isSingleDay
        ? checkOut
        : null;

  const canGoPrevMonth = (() => {
    const floor = parseYmd(floorDate);
    return viewYear > floor.year || (viewYear === floor.year && viewMonth > floor.month);
  })();

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      <button
        id={id}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="seeme-cal-trigger"
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          <CalendarDays className="w-4 h-4 text-[#8d3f28] shrink-0" />
          {isSingleDay ? (
            <span className="font-medium text-[#221f1c] tabular-nums truncate">
              {formatDateVi(checkIn)}
            </span>
          ) : (
            <span className="font-medium text-[#221f1c] tabular-nums truncate">
              {formatDateVi(checkIn)} → {formatDateVi(checkOut)}
            </span>
          )}
        </span>
        {!isSingleDay && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#ebe3d5] text-[#8d3f28] shrink-0 whitespace-nowrap">
            {nights} đêm
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Chọn ngày lưu trú"
          className="absolute left-0 top-full mt-2 z-50 w-[308px] sm:w-[332px] max-w-[calc(100vw-2rem)] bg-white border border-black/15 rounded-xl shadow-xl p-4 space-y-3"
        >
          {/* Month Header */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!canGoPrevMonth}
              aria-label="Tháng trước"
              className="seeme-cal-btn w-9 h-9 rounded-lg flex items-center justify-center text-[#221f1c] hover:bg-[#ebe3d5] disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <strong className="font-display text-base text-[#221f1c]">
              Tháng {viewMonth}, {viewYear}
            </strong>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Tháng sau"
              className="seeme-cal-btn w-9 h-9 rounded-lg flex items-center justify-center text-[#221f1c] hover:bg-[#ebe3d5] transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="seeme-cal-grid text-center text-[11px] font-semibold text-[#5c5750] pb-1 border-b border-black/10">
            {WEEKDAYS_VI.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="seeme-cal-grid">
            {calendarCells.map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} className="h-9" />;
              const disabled = cell.ymd < floorDate;
              const isStart = cell.ymd === checkIn;
              const isEnd = Boolean(previewEnd && cell.ymd === previewEnd);
              const isInRange = Boolean(
                previewEnd && cell.ymd > checkIn && cell.ymd < previewEnd
              );

              let cellCls =
                'text-[#221f1c] hover:bg-[#ebe3d5] font-normal rounded-lg';
              if (disabled) {
                cellCls = 'text-[#9e968c] opacity-40 cursor-not-allowed';
              } else if (isStart || isEnd) {
                cellCls = 'bg-[#8d3f28] text-[#f6f1e7] font-semibold rounded-lg shadow-sm';
              } else if (isInRange) {
                cellCls = 'bg-[#ebe3d5] text-[#221f1c] font-medium rounded-md';
              }

              return (
                <button
                  key={cell.ymd}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDayClick(cell.ymd)}
                  onMouseEnter={() => {
                    if (phase === 'pick_end' && !disabled) setHoverDate(cell.ymd);
                  }}
                  onMouseLeave={() => {
                    if (phase === 'pick_end') setHoverDate(null);
                  }}
                  aria-label={`Chọn ngày ${formatDateVi(cell.ymd)}`}
                  aria-pressed={isStart || isEnd}
                  className={`seeme-cal-btn h-9 w-full flex items-center justify-center text-xs tabular-nums transition ${cellCls}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer Hint & Confirm */}
          <div className="pt-2.5 border-t border-black/10 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-[#5c5750] leading-snug">
              {phase === 'pick_end'
                ? `Đang chọn ${formatDateVi(checkIn)} · Bấm thêm ngày trả phòng nếu ở nhiều ngày`
                : isSingleDay
                  ? `Ở 1 ngày: ${formatDateVi(checkIn)}`
                  : `${formatDateVi(checkIn)} → ${formatDateVi(checkOut)} (${nights} đêm)`}
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPhase('idle');
                setHoverDate(null);
              }}
              className="seeme-cal-btn px-3 py-1.5 rounded-lg bg-[#221f1c] text-[#f6f1e7] text-xs font-semibold shrink-0 hover:bg-[#3c342e]"
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
