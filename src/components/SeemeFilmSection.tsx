'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Volume2, Maximize2 } from 'lucide-react';

interface FilmChapter {
  time: number;
  label: string;
  title: string;
  caption: string;
}

const FILM_CHAPTERS: FilmChapter[] = [
  {
    time: 0,
    label: '00:00',
    title: 'Toàn cảnh bản Lô Lô Chải',
    caption: 'Góc nhìn từ trên cao qua những mái ngói âm dương và tường trình đất',
  },
  {
    time: 20,
    label: '00:20',
    title: 'Cổng đá & hiên gỗ SEEME',
    caption: 'Lối vào homestay giữa sắc hoa đào và khoảng sân đá dưới chân Lũng Cú',
  },
  {
    time: 48,
    label: '00:48',
    title: 'Không gian phòng nghỉ & trà ấm',
    caption: 'Người bản địa chăm chút từng căn phòng, đèn gốm ấm và hiên gỗ mộc',
  },
];

export function SeemeFilmSection() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const autoPausedByScrollRef = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeChapter, setActiveChapter] = useState<number>(0);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const isFullscreen =
          document.fullscreenElement === vid ||
          (document as Document & { webkitFullscreenElement?: Element | null })
            .webkitFullscreenElement === vid;
        if (isFullscreen) return;

        if (!entry.isIntersecting || entry.intersectionRatio < 0.25) {
          if (!vid.paused && !vid.ended) {
            autoPausedByScrollRef.current = true;
            vid.pause();
          }
        } else if (entry.intersectionRatio >= 0.35 && autoPausedByScrollRef.current && !vid.ended) {
          autoPausedByScrollRef.current = false;
          const p = vid.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              vid.muted = true;
              vid.play().catch(() => {});
            });
          }
        }
      },
      { threshold: [0, 0.25, 0.35, 0.5] }
    );

    observer.observe(vid);
    return () => observer.disconnect();
  }, []);

  function playFrom(seconds?: number) {
    const vid = videoRef.current;
    if (!vid) return;
    autoPausedByScrollRef.current = false;
    if (typeof seconds === 'number') {
      vid.currentTime = seconds;
    }
    setHasStarted(true);
    const p = vid.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // Fallback if browser blocks unmuted play
        vid.muted = true;
        vid.play().catch(() => {});
      });
    }
  }

  function handleTimeUpdate() {
    const vid = videoRef.current;
    if (!vid) return;
    const t = vid.currentTime;
    let idx = 0;
    for (let i = FILM_CHAPTERS.length - 1; i >= 0; i--) {
      if (t >= FILM_CHAPTERS[i].time - 0.5) {
        idx = i;
        break;
      }
    }
    setActiveChapter(idx);
  }

  function requestFullscreen() {
    const vid = videoRef.current;
    if (!vid) return;
    if (!hasStarted) {
      playFrom(0);
    }
    if (vid.requestFullscreen) {
      vid.requestFullscreen().catch(() => {});
    }
  }

  return (
    <section
      className="section bg-[#1c1916] text-[#f6f1e7] py-14 lg:py-20"
      id="thuoc-phim"
      aria-labelledby="film-h"
      data-seeme-film
    >
      <div className="wrap space-y-8">
        {/* Top Editorial Header */}
        <div className="grid lg:grid-cols-12 gap-5 lg:gap-8 items-end">
          <div className="lg:col-span-7 space-y-2.5">
            <span className="inline-block text-xs uppercase tracking-[0.18em] text-[#d9a68b] font-bold">
              Thước phim thực tế · Lô Lô Chải
            </span>
            <h2
              id="film-h"
              className="font-display text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-[#f6f1e7] leading-snug tracking-tight"
            >
              Chạm vào nhịp sống bình yên tại SEEME Homestay
            </h2>
          </div>

          <div className="lg:col-span-5 space-y-2.5 lg:text-right">
            <p className="text-sm sm:text-[15px] text-[#cdc5b9] leading-relaxed">
              Từ toàn cảnh những mái ngói âm dương thôn cổ Lô Lô Chải đến nếp nhà trình tường ấm
              đèn — mời bạn dạo một vòng quanh SEEME trước chuyến đi lên Cực Bắc.
            </p>
            <div className="inline-flex flex-wrap items-center gap-3 text-xs text-[#b5aca0] font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-[#d9a68b]" />
                Phim ngắn 02:29 · Có âm thanh
              </span>
              <button
                type="button"
                onClick={requestFullscreen}
                data-film-fullscreen
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2a2520] hover:bg-[#38312a] border border-white/15 text-[#f6f1e7] transition cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[#d9a68b]" />
                Toàn màn hình
              </button>
            </div>
          </div>
        </div>

        {/* Widescreen Cinema Frame */}
        <div className="relative rounded-2xl overflow-hidden border border-white/12 bg-[#12100e] shadow-2xl">
          <div className="relative w-full aspect-[16/9] sm:aspect-[1004/376] bg-[#12100e]">
            <video
              ref={videoRef}
              src="/assets/video/seeme-homestay-film.mp4"
              poster="/assets/video/seeme-film-poster.jpg"
              controls={hasStarted}
              playsInline
              preload="metadata"
              onPlay={() => {
                autoPausedByScrollRef.current = false;
                setHasStarted(true);
              }}
              onTimeUpdate={handleTimeUpdate}
              data-film-video
              className={`w-full h-full block ${
                hasStarted ? 'object-contain' : 'object-cover'
              }`}
            >
              Trình duyệt của bạn chưa hỗ trợ phát video trực tiếp.
            </video>

            {/* Curated Poster Play Overlay (Hidden once playback starts) */}
            {!hasStarted && (
              <button
                type="button"
                onClick={() => playFrom(0)}
                data-film-overlay
                aria-label="Phát phim giới thiệu SEEME Homestay thời lượng 2 phút 29 giây"
                className="group absolute inset-0 w-full h-full p-0 border-0 bg-[#12100e] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d9a68b]"
              >
                <img
                  src="/assets/video/seeme-film-poster.jpg"
                  alt="Toàn cảnh bản Lô Lô Chải và SEEME Homestay từ trên cao"
                  width={1004}
                  height={376}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-[#12100e]/75 via-[#12100e]/25 to-[#12100e]/15 transition group-hover:via-[#12100e]/15" />
                <span className="relative z-10 flex flex-col items-center justify-center gap-3.5 w-full h-full">
                  <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#f6f1e7] text-[#221f1c] flex items-center justify-center shadow-2xl transition duration-200 group-hover:scale-105 group-hover:bg-[#8d3f28] group-hover:text-[#f6f1e7]">
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
                  </span>
                  <span className="px-4 py-1.5 rounded-full bg-[#1c1916]/85 backdrop-blur-sm border border-white/20 text-xs sm:text-sm font-bold text-[#f6f1e7] tracking-wide shadow-lg">
                    Xem phim giới thiệu SEEME · 02:29
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Scene Chapters + Bottom Action */}
        <div className="grid md:grid-cols-3 gap-3.5">
          {FILM_CHAPTERS.map((chap, idx) => {
            const isActive = hasStarted && activeChapter === idx;
            return (
              <button
                key={chap.label}
                type="button"
                onClick={() => playFrom(chap.time)}
                data-film-chapter={chap.time}
                className={`text-left rounded-xl p-4 border transition ${
                  isActive
                    ? 'bg-[#2a241f] border-[#c47858]/70 text-[#f6f1e7]'
                    : 'bg-[#24201c] border-white/10 text-[#e4ddd3] hover:border-white/25 hover:bg-[#2a2520]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-extrabold tracking-wider text-[#d9a68b] tabular-nums">
                    {chap.label}
                  </span>
                  <span className="text-[11px] text-[#b5aca0] font-semibold">
                    {isActive ? 'Đang phát' : 'Xem đoạn này →'}
                  </span>
                </div>
                <div className="font-display font-bold text-[15px] text-[#f6f1e7]">
                  {chap.title}
                </div>
                <p className="text-xs text-[#b8afa2] mt-1 leading-relaxed">{chap.caption}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
