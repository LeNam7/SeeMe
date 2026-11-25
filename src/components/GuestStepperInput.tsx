'use client';

import React, { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface GuestStepperInputProps {
  id: string;
  value: number;
  onChange: (nextValue: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

/** Numeric guest counter supporting both direct keyboard entry and +/- step buttons. */
export function GuestStepperInput({
  id,
  value,
  onChange,
  min = 1,
  max = 30,
  className = '',
}: GuestStepperInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commitClamped(rawValue: number) {
    const clamped = Math.min(max, Math.max(min, Math.trunc(rawValue)));
    setDraft(String(clamped));
    if (clamped !== value) {
      onChange(clamped);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D+/g, '');
    if (digitsOnly === '') {
      setDraft('');
      return;
    }

    const parsed = Number.parseInt(digitsOnly, 10);
    if (Number.isNaN(parsed)) {
      return;
    }

    if (parsed > max) {
      setDraft(String(max));
      if (max !== value) onChange(max);
      return;
    }

    if (parsed >= min) {
      setDraft(String(parsed));
      if (parsed !== value) onChange(parsed);
    } else {
      // Allow typing "0" momentarily before "05" or before clamping to min on blur
      setDraft('0');
    }
  }

  function handleBlur() {
    if (draft.trim() === '') {
      commitClamped(min);
      return;
    }
    const parsed = Number.parseInt(draft, 10);
    commitClamped(Number.isNaN(parsed) ? min : parsed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      commitClamped(value + 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      commitClamped(value - 1);
    } else if (e.key === 'Enter') {
      handleBlur();
    }
  }

  const buttonClass =
    'w-11 h-full shrink-0 flex items-center justify-center text-[#221f1c] bg-[#faf7f1] hover:bg-[#ebe3d5] active:bg-[#e1d5c1] disabled:opacity-40 disabled:pointer-events-none transition-colors outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8d3f28]';

  return (
    <div className={`seeme-stepper h-[44px] ${className}`.trim()}>
      <button
        type="button"
        onClick={() => commitClamped(value - 1)}
        disabled={value <= min}
        className={`${buttonClass} border-r border-black/15 rounded-l-[5px]`}
        aria-label="Giảm số lượng khách"
      >
        <Minus className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0 h-full flex items-center justify-center px-1.5">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          role="spinbutton"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          value={draft}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.currentTarget.select()}
          className="seeme-no-spinner w-full h-full min-w-0 bg-transparent text-center font-semibold text-[0.95rem] text-[#221f1c] focus:outline-none tabular-nums"
        />
      </div>

      <button
        type="button"
        onClick={() => commitClamped(value + 1)}
        disabled={value >= max}
        className={`${buttonClass} border-l border-black/15 rounded-r-[5px]`}
        aria-label="Tăng số lượng khách"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
