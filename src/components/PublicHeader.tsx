'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from './BrandMark';

const DESKTOP_NAV_ITEMS = [
  { id: 'khong-gian', label: 'Không gian' },
  { id: 'hang-phong', label: 'Phòng nghỉ' },
  { id: 'trai-nghiem', label: 'Trải nghiệm' },
  { id: 'vi-tri', label: 'Vị trí' },
];

const MOBILE_SECTION_ITEMS = [
  { id: 'cau-chuyen', label: 'Câu chuyện' },
  { id: 'khong-gian', label: 'Không gian' },
  { id: 'hang-phong', label: 'Các hạng phòng' },
  { id: 'trai-nghiem', label: 'Ẩm thực & Bếp lửa' },
  { id: 'bo-suu-tap', label: 'Bộ sưu tập' },
  { id: 'vi-tri', label: 'Đường đi & Liên hệ' },
];

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function PublicHeader({
  hotline = '0932.237.796',
  hotlineRaw = '0932237796',
}: {
  hotline?: string;
  hotlineRaw?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const rafRef = useRef<number | null>(null);

  function cancelActiveScroll() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function smoothScrollToId(sectionId: string): boolean {
    const target = document.getElementById(sectionId);
    if (!target) return false;

    cancelActiveScroll();

    const headerEl = document.querySelector('header.nav');
    const headerOffset = headerEl ? headerEl.getBoundingClientRect().height + 10 : 82;
    const startY = window.scrollY;
    const rawTargetY = target.getBoundingClientRect().top + startY - headerOffset;
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const targetY = Math.max(0, Math.min(rawTargetY, maxScrollY));
    const distance = targetY - startY;

    if (Math.abs(distance) < 2) {
      window.history.replaceState(null, '', `#${sectionId}`);
      return true;
    }

    const duration = Math.min(850, Math.max(450, Math.abs(distance) * 0.4));
    const startTime = performance.now();
    const htmlEl = document.documentElement;
    const prevBehavior = htmlEl.style.scrollBehavior;
    htmlEl.style.scrollBehavior = 'auto';

    const stopOnUserInput = () => {
      cancelActiveScroll();
      htmlEl.style.scrollBehavior = prevBehavior;
      window.removeEventListener('wheel', stopOnUserInput);
      window.removeEventListener('touchstart', stopOnUserInput);
    };

    window.addEventListener('wheel', stopOnUserInput, { passive: true });
    window.addEventListener('touchstart', stopOnUserInput, { passive: true });

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeInOutCubic(progress);
      window.scrollTo(0, Math.round(startY + distance * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        htmlEl.style.scrollBehavior = prevBehavior;
        window.removeEventListener('wheel', stopOnUserInput);
        window.removeEventListener('touchstart', stopOnUserInput);
        window.history.replaceState(null, '', `#${sectionId}`);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return true;
  }

  // Smoothly handle any in-page #anchor links on the homepage (hero CTAs, footer links, etc.)
  useEffect(() => {
    if (pathname !== '/') return;
    const onDocumentClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }
      const targetEl = e.target as HTMLElement | null;
      const anchor = targetEl?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const rawHref = anchor.getAttribute('href') || '';
      const match = rawHref.match(/^\/?#([a-zA-Z0-9_-]+)$/);
      if (!match) return;
      const sectionId = match[1];
      if (!document.getElementById(sectionId)) return;
      e.preventDefault();
      setMenuOpen(false);
      smoothScrollToId(sectionId);
    };

    document.addEventListener('click', onDocumentClick);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      cancelActiveScroll();
    };
  }, [pathname]);

  function handleSectionClick(e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) {
    setMenuOpen(false);
    if (pathname !== '/') return;
    if (smoothScrollToId(sectionId)) {
      e.preventDefault();
    }
  }

  return (
    <header className="nav border-b border-black/10 bg-[#f6f1e7]/95 backdrop-blur-sm">
      <div className="wrap nav__bar">
        <Link className="nav__logo shrink-0 whitespace-nowrap" href="/" aria-label="SEEME Homestay Trang chủ">
          <BrandMark />
        </Link>

        <nav className="nav__links" aria-label="Điều hướng chính">
          {DESKTOP_NAV_ITEMS.map((item) => (
            <div key={item.id} className="nav__item">
              {pathname === '/' ? (
                <a
                  className="nav__link whitespace-nowrap"
                  href={`#${item.id}`}
                  onClick={(e) => handleSectionClick(e, item.id)}
                >
                  {item.label}
                </a>
              ) : (
                <Link className="nav__link whitespace-nowrap" href={`/#${item.id}`}>
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className="nav__actions hidden sm:flex">
          {pathname === '/' ? (
            <a
              className="btn btn--primary whitespace-nowrap"
              href="#dat-phong"
              onClick={(e) => handleSectionClick(e, 'dat-phong')}
            >
              Đặt phòng ngay
            </a>
          ) : (
            <Link className="btn btn--primary whitespace-nowrap" href="/#dat-phong">
              Đặt phòng ngay
            </Link>
          )}
        </div>

        <button
          className="nav__toggle shrink-0"
          type="button"
          aria-expanded={menuOpen}
          aria-label="Mở menu điều hướng"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d={menuOpen ? 'M4 4l10 10M14 4L4 14' : 'M2 5h14M2 13h14'}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div
          className="lg:hidden border-t border-black/10 bg-[#f6f1e7] px-5 py-4 space-y-3"
          role="dialog"
          aria-label="Menu di động"
        >
          <div className="grid grid-cols-2 gap-3 text-sm font-medium">
            {MOBILE_SECTION_ITEMS.map((item) =>
              pathname === '/' ? (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => handleSectionClick(e, item.id)}
                  className="py-1.5"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.id}
                  href={`/#${item.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="py-1.5"
                >
                  {item.label}
                </Link>
              )
            )}
            <Link href="/terms" onClick={() => setMenuOpen(false)} className="py-1.5">
              Chính sách hoàn/hủy
            </Link>
          </div>
          <div className="pt-2 flex gap-2">
            {pathname === '/' ? (
              <a
                href="#dat-phong"
                onClick={(e) => handleSectionClick(e, 'dat-phong')}
                className="btn btn--primary flex-1 text-center"
              >
                Đặt phòng ngay
              </a>
            ) : (
              <Link
                href="/#dat-phong"
                onClick={() => setMenuOpen(false)}
                className="btn btn--primary flex-1 text-center"
              >
                Đặt phòng ngay
              </Link>
            )}
            <a href={`tel:${hotlineRaw}`} className="btn btn--secondary">
              Gọi {hotline}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
