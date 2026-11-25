import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'SEEME (SI MÊ) Homestay — Lô Lô Chải, Lũng Cú, Đồng Văn, Hà Giang',
    template: '%s | SEEME Homestay',
  },
  description:
    'SEEME (SI MÊ) là căn nhà nhỏ xinh ở thôn Lô Lô Chải, nằm nép mình dưới chân cột cờ Quốc Gia Lũng Cú. Đặt phòng trực tiếp, chọn lẩu bò, bếp lửa và kiểm tra lịch phòng thực tế.',
  openGraph: {
    title: 'SEEME (SI MÊ) Homestay — Lô Lô Chải, Lũng Cú',
    description:
      'Lưu trú ấm áp tại thôn Lô Lô Chải dưới chân Cột cờ Lũng Cú. Phòng Hoa Lê, Anh Đào, Lô Lô Hoa, Mộc Miên.',
    locale: 'vi_VN',
    type: 'website',
    images: ['/assets/img/seeme/space-2.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-type="place" data-radius="soft" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/assets/system.css" />
        <link rel="stylesheet" href="/assets/ui/cards.css" />
        <link rel="stylesheet" href="/assets/motion/motion.css" />
        <link rel="stylesheet" href="/assets/backgrounds/backgrounds.css" />
        <link rel="stylesheet" href="/assets/layout/layout.css" />
        <link rel="stylesheet" href="/assets/icons/icon.css" />
        <style
          id="seeme-brand-tokens"
          dangerouslySetInnerHTML={{
            __html: `
:root {
  --p-bg: #f6f1e7; --p-surface: #ebe3d5; --p-ink: #221f1c; --p-muted: #47423c;
  --p-accent: #8d3f28; --p-accent-ink: #f6f1e7; --p-action: #8d3f28; --p-action-ink: #f6f1e7;
  --p-inv-bg: #221f1c; --p-inv-surface: #2e2b28; --p-inv-ink: #f6f1e7; --p-inv-muted: #d1c9be;
  --p-inv-accent: #f6f1e7; --p-inv-accent-ink: #221f1c; --p-inv-action: #f6f1e7; --p-inv-action-ink: #221f1c;
  --bg: var(--p-bg); --surface: var(--p-surface); --ink: var(--p-ink); --muted: var(--p-muted);
  --accent: var(--p-accent); --accent-ink: var(--p-accent-ink); --action: var(--p-action); --action-ink: var(--p-action-ink);
  --font-display: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-text: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --display-weight: 800;
  --display-tracking: -0.015em;
}
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body { font-family: var(--font-text); font-weight: 500; line-height: 1.65; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
h1, h2, h3, .font-display { font-family: var(--font-display); letter-spacing: -0.015em; }
h1, h2 { font-weight: 800; line-height: 1.26; }
h3 { font-weight: 700; line-height: 1.32; }
main > section:not(.hero), footer.closing { height: auto !important; min-height: 0 !important; }
main > section.hero.hero--place { --photo: min(460px, 51svh); height: auto !important; min-height: 100svh; padding-bottom: 2.5rem; }
main > section.hero.hero--place .hero__text > h1 { font-size: clamp(29px, 2.1vw + 18px, 45px) !important; line-height: 1.2 !important; font-weight: 800 !important; letter-spacing: -0.02em !important; }
footer.closing { padding: 0 !important; }
img.h-full { height: 100%; }
/* Restore multi-column Tailwind grids after system.css .grid rule */
.grid[class*="grid-cols-"] { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid[class*="grid-cols-"] > * { grid-column: auto; }
.grid.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid > .col-span-2 { grid-column: span 2 / span 2; }
@media (min-width: 640px) {
  .grid.sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid.sm\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid.sm\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .grid.sm\\:grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}
@media (min-width: 768px) {
  .grid.md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid.md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid.md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .grid.md\\:grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
  .grid > .md\\:col-span-3 { grid-column: span 3 / span 3; }
  .grid > .md\\:col-span-4 { grid-column: span 4 / span 4; }
  .grid > .md\\:col-span-5 { grid-column: span 5 / span 5; }
  .grid > .md\\:col-span-7 { grid-column: span 7 / span 7; }
}
@media (min-width: 1024px) {
  .grid.lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid.lg\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .grid.lg\\:grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .grid.lg\\:grid-cols-7 { grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .grid.lg\\:grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
  .grid > .lg\\:col-span-5 { grid-column: span 5 / span 5; }
  .grid > .lg\\:col-span-6 { grid-column: span 6 / span 6; }
  .grid > .lg\\:col-span-7 { grid-column: span 7 / span 7; }
  .grid > .lg\\:col-span-2 { grid-column: span 2 / span 2; }
}
`,
          }}
        />
        <meta name="page-type" content="place" />
        <meta name="page-kind" content="place" />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('m-js');setTimeout(function(){document.documentElement.classList.add('m-enter-done','mo-safe')},120);`,
          }}
        />
      </head>
      <body>
        {children}
        <script type="module" src="/assets/system.js" defer />
      </body>
    </html>
  );
}
