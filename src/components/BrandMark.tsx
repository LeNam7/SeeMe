import React from 'react';

export function BrandMark({
  inverted = false,
  compact = false,
}: {
  inverted?: boolean;
  compact?: boolean;
}) {
  const variant = inverted ? 'light' : 'dark';

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <img
        src={`/assets/img/seeme/logo-emblem-${variant}.png`}
        alt=""
        aria-hidden="true"
        style={{ height: compact ? '28px' : '34px', width: 'auto' }}
        className="object-contain shrink-0"
      />
      <span className="flex flex-col justify-center leading-none gap-1">
        <img
          src={`/assets/img/seeme/logo-word-${variant}.png`}
          alt="SEEME Homestay"
          style={{ height: compact ? '16px' : '18px', width: 'auto' }}
          className="object-contain object-left"
        />
        {!compact && (
          <span
            className="hidden sm:block text-[10px] uppercase tracking-[0.2em]"
            style={{ color: inverted ? '#c2bab0' : '#47423c' }}
          >
            Homestay · Lô Lô Chải
          </span>
        )}
      </span>
    </span>
  );
}
