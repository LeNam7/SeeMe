import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = process.env.DEMO_ORIGIN || 'http://127.0.0.1:3000';
const OUT_DIR = path.resolve(process.cwd(), 'out-gh-pages');

const ROUTES = [
  { route: '/', outFile: 'index.html', depth: 0 },
  { route: '/rooms/hoa-le', outFile: 'rooms/hoa-le/index.html', depth: 2 },
  { route: '/rooms/anh-dao', outFile: 'rooms/anh-dao/index.html', depth: 2 },
  { route: '/rooms/lo-lo-hoa', outFile: 'rooms/lo-lo-hoa/index.html', depth: 2 },
  { route: '/rooms/moc-mien', outFile: 'rooms/moc-mien/index.html', depth: 2 },
  { route: '/book', outFile: 'book/index.html', depth: 1 },
  { route: '/terms', outFile: 'terms/index.html', depth: 1 },
  { route: '/privacy', outFile: 'privacy/index.html', depth: 1 },
  { route: '/credits', outFile: 'credits/index.html', depth: 1 },
];

const GH_DEMO_JS = `(() => {
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let activeRaf = null;

  function smoothScrollToId(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return false;
    if (activeRaf) cancelAnimationFrame(activeRaf);
    const header = document.querySelector('header.nav');
    const offset = header ? header.getBoundingClientRect().height + 10 : 82;
    const startY = window.scrollY;
    const rawTargetY = target.getBoundingClientRect().top + startY - offset;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const targetY = Math.max(0, Math.min(rawTargetY, maxY));
    const dist = targetY - startY;
    if (Math.abs(dist) < 2) return true;

    const duration = Math.min(850, Math.max(450, Math.abs(dist) * 0.4));
    const startTime = performance.now();
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';

    const cancel = () => {
      if (activeRaf) cancelAnimationFrame(activeRaf);
      activeRaf = null;
      html.style.scrollBehavior = prev;
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
    };
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });

    const step = (now) => {
      const p = Math.min(1, (now - startTime) / duration);
      window.scrollTo(0, Math.round(startY + dist * easeInOutCubic(p)));
      if (p < 1) {
        activeRaf = requestAnimationFrame(step);
      } else {
        cancel();
        history.replaceState(null, '', '#' + sectionId);
      }
    };
    activeRaf = requestAnimationFrame(step);
    return true;
  }

  // Smooth scroll for in-page anchor links
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const m = href.match(/^(?:\\.\\/)?#([a-zA-Z0-9_-]+)$/);
    if (!m) return;
    if (smoothScrollToId(m[1])) {
      e.preventDefault();
    }
  });

  // Mobile nav toggle
  const toggleBtn = document.querySelector('button.nav__toggle');
  if (toggleBtn) {
    let mobileMenu = null;
    toggleBtn.addEventListener('click', () => {
      if (!mobileMenu) {
        mobileMenu = document.createElement('div');
        mobileMenu.className = 'lg:hidden border-t border-black/10 bg-[#f6f1e7] px-5 py-4 space-y-3';
        const links = Array.from(document.querySelectorAll('header.nav nav.nav__links a'));
        mobileMenu.innerHTML =
          '<div class="grid grid-cols-2 gap-3 text-sm font-medium">' +
          links.map((l) => '<a href="' + l.getAttribute('href') + '" class="py-1.5">' + l.textContent + '</a>').join('') +
          '</div>';
        document.querySelector('header.nav')?.appendChild(mobileMenu);
        mobileMenu.addEventListener('click', (ev) => {
          if (ev.target.closest('a')) {
            mobileMenu.style.display = 'none';
            toggleBtn.setAttribute('aria-expanded', 'false');
          }
        });
      } else {
        const isHidden = mobileMenu.style.display === 'none';
        mobileMenu.style.display = isHidden ? '' : 'none';
        toggleBtn.setAttribute('aria-expanded', String(isHidden));
      }
    });
  }

  // Homepage Gallery filter tabs + Lightbox
  const galSection = document.getElementById('bo-suu-tap');
  if (galSection) {
    const tabs = Array.from(galSection.querySelectorAll('button[role="tab"]'));
    const cards = Array.from(galSection.querySelectorAll('button[aria-label^="Phóng to ảnh:"]'));
    const categories = [
      'Ngoại cảnh & Kiến trúc', 'Ngoại cảnh & Kiến trúc', 'Ngoại cảnh & Kiến trúc',
      'Không gian chung', 'Không gian chung', 'Không gian chung',
      'Phòng nghỉ', 'Phòng nghỉ', 'Phòng nghỉ'
    ];
    cards.forEach((c, i) => { c.dataset.cat = categories[i] || ''; });

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const cat = tab.textContent.trim();
        tabs.forEach((t) => {
          const active = t === tab;
          t.setAttribute('aria-selected', String(active));
          t.className = active
            ? 'px-4 py-2 text-sm rounded-md transition border bg-[#221f1c] text-[#f6f1e7] border-[#221f1c]'
            : 'px-4 py-2 text-sm rounded-md transition border bg-white text-[#221f1c] border-black/15 hover:border-black/40';
        });
        cards.forEach((c) => {
          c.style.display = cat === 'Tất cả' || c.dataset.cat === cat ? '' : 'none';
        });
      });
    });

    function openLightbox(src, alt) {
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-50 bg-[#151311]/95 flex flex-col items-center justify-center p-4 sm:p-8';
      overlay.innerHTML =
        '<button type="button" aria-label="Đóng" style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.14);color:#fff;border:0;border-radius:999px;width:40px;height:40px;font-size:22px;cursor:pointer;">&times;</button>' +
        '<img src="' + src + '" alt="' + (alt || '').replace(/"/g, '&quot;') + '" style="max-height:80vh;max-width:92vw;object-fit:contain;border-radius:8px;" />' +
        '<p style="color:#e8e1d7;font-size:13px;margin-top:12px;text-align:center;max-width:640px;">' + (alt || '') + '</p>';
      const close = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
      const onEsc = (ev) => { if (ev.key === 'Escape') close(); };
      overlay.addEventListener('click', close);
      document.addEventListener('keydown', onEsc);
      document.body.appendChild(overlay);
    }

    cards.forEach((c) => {
      c.addEventListener('click', () => {
        const img = c.querySelector('img');
        if (img) openLightbox(img.src, img.alt);
      });
    });
  }

  // Room detail page thumbnail switcher + lightbox
  const mainRoomBtn = document.querySelector('button[aria-label^="Xem toàn màn hình ảnh"]');
  if (mainRoomBtn) {
    const mainImg = mainRoomBtn.querySelector('img');
    const thumbBtns = Array.from(document.querySelectorAll('button[aria-label^="Chọn ảnh "]'));
    const counterSpan = mainRoomBtn.querySelector('span');
    thumbBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const tImg = btn.querySelector('img');
        if (!tImg || !mainImg) return;
        mainImg.src = tImg.src;
        mainImg.alt = tImg.alt;
        thumbBtns.forEach((b, j) => {
          b.className = 'aspect-[4/3] rounded-lg overflow-hidden border-2 transition ' +
            (j === idx ? 'border-[#8d3f28]' : 'border-transparent opacity-75 hover:opacity-100');
        });
        if (counterSpan) {
          counterSpan.lastChild.textContent = ' Xem toàn màn hình (' + (idx + 1) + '/' + thumbBtns.length + ')';
        }
      });
    });
    mainRoomBtn.addEventListener('click', () => {
      if (!mainImg) return;
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-50 bg-[#151311]/95 flex flex-col items-center justify-center p-4 sm:p-8';
      overlay.innerHTML =
        '<button type="button" aria-label="Đóng" style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.14);color:#fff;border:0;border-radius:999px;width:40px;height:40px;font-size:22px;cursor:pointer;">&times;</button>' +
        '<img src="' + mainImg.src + '" alt="' + (mainImg.alt || '').replace(/"/g, '&quot;') + '" style="max-height:80vh;max-width:92vw;object-fit:contain;border-radius:8px;" />' +
        '<p style="color:#e8e1d7;font-size:13px;margin-top:12px;text-align:center;max-width:640px;">' + (mainImg.alt || '') + '</p>';
      overlay.addEventListener('click', () => overlay.remove());
      document.body.appendChild(overlay);
    });
  }

  // Guest stepper +/- interactivity
  document.querySelectorAll('.seeme-stepper').forEach((stepper) => {
    const input = stepper.querySelector('input');
    const btns = stepper.querySelectorAll('button');
    if (!input || btns.length < 2) return;
    const min = Number(input.getAttribute('min') || 1);
    const max = Number(input.getAttribute('max') || 16);
    btns[0].addEventListener('click', () => {
      const v = Math.max(min, (parseInt(input.value, 10) || min) - 1);
      input.value = String(v);
    });
    btns[1].addEventListener('click', () => {
      const v = Math.min(max, (parseInt(input.value, 10) || min) + 1);
      input.value = String(v);
    });
  });

  // Gentle notice on static GitHub Pages booking submit
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Đây là bản Demo xem trước trên GitHub Pages. Để đặt phòng thực tế hoặc nhắn chủ homestay, vui lòng liên hệ Hotline/Zalo 0932.237.796.');
    });
  });
})();
`;

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function rewriteHtml(html, depth) {
  const prefix = depth === 0 ? './' : '../'.repeat(depth);

  let out = html;

  // 1. Strip Next.js runtime JS chunks & RSC flight payloads so Next router never 404s on GitHub Pages subpath
  out = out.replace(/<script[^>]*src="\/_next\/static\/chunks\/[^"]+"[^>]*><\/script>/gi, '');
  out = out.replace(/<link[^>]*rel="preload"[^>]*href="\/_next\/static\/chunks\/[^"]+"[^>]*\/?>/gi, '');
  out = out.replace(/<script>self\.__next_f[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<script>\(self\.__next_f=self\.__next_f\|\|\[\]\)\.push[\s\S]*?<\/script>/gi, '');

  // 2. Rewrite compiled CSS and icon paths
  out = out.replace(/\/_next\/static\/css\//g, `${prefix}css/`);
  out = out.replace(/href="\/icon\.png[^"]*"/g, `href="${prefix}icon.png"`);

  // 3. Rewrite /assets/... URLs (src, href, srcset, CSS url)
  out = out.replace(/(src|href)="\/assets\//g, `$1="${prefix}assets/`);
  out = out.replace(/srcSet="\/assets\//gi, `srcset="${prefix}assets/`);

  // 4. Rewrite internal page links cleanly to relative paths
  out = out.replace(/href="\/rooms\/([a-z0-9-]+)(\?[^"]*)?"/g, `href="${prefix}rooms/$1/"`);
  out = out.replace(/href="\/book(\?[^"]*)?"/g, `href="${prefix}book/"`);
  out = out.replace(/href="\/terms"/g, `href="${prefix}terms/"`);
  out = out.replace(/href="\/privacy"/g, `href="${prefix}privacy/"`);
  out = out.replace(/href="\/credits"/g, `href="${prefix}credits/"`);
  out = out.replace(/href="\/admin"/g, `href="${prefix}#hang-phong"`);
  out = out.replace(/href="\/#([a-zA-Z0-9_-]+)"/g, depth === 0 ? `href="#$1"` : `href="${prefix}#$1"`);
  out = out.replace(/href="\/"/g, `href="${prefix}"`);

  // 5. Inject lightweight static interactive script before </body>
  out = out.replace('</body>', `<script src="${prefix}gh-demo.js" defer></script></body>`);

  return out;
}

async function main() {
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Copy static assets, compiled CSS, and favicon
  copyDir(path.resolve(process.cwd(), 'public', 'assets'), path.join(OUT_DIR, 'assets'));
  const cssSrc = path.resolve(process.cwd(), '.next', 'static', 'css');
  if (fs.existsSync(cssSrc)) {
    copyDir(cssSrc, path.join(OUT_DIR, 'css'));
  }
  const iconSrc = path.resolve(process.cwd(), 'src', 'app', 'icon.png');
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(OUT_DIR, 'icon.png'));
  }

  // Write .nojekyll so GitHub Pages serves everything cleanly
  fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');
  fs.writeFileSync(path.join(OUT_DIR, 'gh-demo.js'), GH_DEMO_JS, 'utf8');

  // Snapshot every public route from the live server
  for (const r of ROUTES) {
    const res = await fetch(`${ORIGIN}${r.route}`);
    if (!res.ok) throw new Error(`Failed to fetch ${r.route}: HTTP ${res.status}`);
    const rawHtml = await res.text();
    const rewritten = rewriteHtml(rawHtml, r.depth);
    const destPath = path.join(OUT_DIR, r.outFile);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, rewritten, 'utf8');
    console.log(`Exported ${r.route} -> ${r.outFile} (${Math.round(rewritten.length / 1024)}KB)`);
  }

  console.log('GitHub Pages static demo built cleanly into out-gh-pages/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
