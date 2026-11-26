(() => {
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
    const m = href.match(/^(?:\.\/)?#([a-zA-Z0-9_-]+)$/);
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

  // Official SEEME Cinema Film play overlay + chapters + fullscreen + scroll auto-pause/resume
  const filmWrap = document.querySelector('[data-seeme-film]');
  if (filmWrap) {
    const vid = filmWrap.querySelector('[data-film-video]');
    const overlay = filmWrap.querySelector('[data-film-overlay]');
    const fsBtn = filmWrap.querySelector('[data-film-fullscreen]');
    const chapBtns = Array.from(filmWrap.querySelectorAll('[data-film-chapter]'));
    let autoPausedByScroll = false;

    const startFilm = (sec) => {
      if (!vid) return;
      autoPausedByScroll = false;
      if (typeof sec === 'number') vid.currentTime = sec;
      vid.controls = true;
      vid.classList.remove('object-cover');
      vid.classList.add('object-contain');
      if (overlay) overlay.style.display = 'none';
      const p = vid.play();
      if (p && p.catch) p.catch(() => { vid.muted = true; vid.play().catch(() => {}); });
    };
    if (vid) {
      vid.addEventListener('play', () => { autoPausedByScroll = false; });
      if (typeof IntersectionObserver !== 'undefined') {
        const io = new IntersectionObserver((entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (document.fullscreenElement === vid || document.webkitFullscreenElement === vid) return;
          if (!entry.isIntersecting || entry.intersectionRatio < 0.25) {
            if (!vid.paused && !vid.ended) {
              autoPausedByScroll = true;
              vid.pause();
            }
          } else if (entry.intersectionRatio >= 0.35 && autoPausedByScroll && !vid.ended) {
            autoPausedByScroll = false;
            const p = vid.play();
            if (p && p.catch) p.catch(() => { vid.muted = true; vid.play().catch(() => {}); });
          }
        }, { threshold: [0, 0.25, 0.35, 0.5] });
        io.observe(vid);
      }
    }
    if (overlay) overlay.addEventListener('click', () => startFilm(0));
    chapBtns.forEach((b) => {
      b.addEventListener('click', () => startFilm(Number(b.getAttribute('data-film-chapter') || 0)));
    });
    if (fsBtn && vid) {
      fsBtn.addEventListener('click', () => {
        startFilm();
        if (vid.requestFullscreen) vid.requestFullscreen().catch(() => {});
      });
    }
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

  // Dining menu category tabs + food photo / official menu lightbox
  const diningWrap = document.querySelector('[data-dining-menu]');
  if (diningWrap) {
    const mTabs = Array.from(diningWrap.querySelectorAll('[data-menu-tab]'));
    const mPanels = Array.from(diningWrap.querySelectorAll('[data-menu-panel]'));
    const noteEl = diningWrap.querySelector('[data-menu-note]');
    const notes = {
      LAU: 'Nồi tối thiểu 2 người',
      BBQ: 'Chuẩn bị than hồng tại sân',
      SIDE: 'Đặc sản địa phương Hà Giang',
    };
    mTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const id = tab.getAttribute('data-menu-tab');
        mTabs.forEach((t) => {
          const active = t === tab;
          t.setAttribute('aria-selected', String(active));
          t.className = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition border ' +
            (active ? 'bg-[#221f1c] text-[#f6f1e7] border-[#221f1c]' : 'bg-white text-[#221f1c] border-black/15 hover:border-black/35');
          const badge = t.querySelector('span:last-child');
          if (badge) {
            badge.className = 'text-[11px] px-1.5 py-0.5 rounded-full ' +
              (active ? 'bg-white/15 text-[#f6f1e7]' : 'bg-[#ebe3d5] text-[#5c5750]');
          }
        });
        mPanels.forEach((p) => {
          const show = p.getAttribute('data-menu-panel') === id;
          p.classList.toggle('hidden', !show);
          p.classList.toggle('block', show);
        });
        if (noteEl && notes[id]) noteEl.textContent = notes[id];
      });
    });

    function openDiningLightbox(src, alt) {
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-50 bg-[#151311]/95 flex flex-col items-center justify-center p-4 sm:p-8';
      overlay.innerHTML =
        '<button type="button" aria-label="Đóng" style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.14);color:#fff;border:0;border-radius:999px;width:40px;height:40px;font-size:22px;cursor:pointer;">&times;</button>' +
        '<img src="' + src + '" alt="' + (alt || '').replace(/"/g, '&quot;') + '" style="max-height:82vh;max-width:92vw;object-fit:contain;border-radius:8px;" />' +
        '<p style="color:#e8e1d7;font-size:13px;margin-top:12px;text-align:center;max-width:640px;">' + (alt || '') + '</p>';
      const close = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
      const onEsc = (ev) => { if (ev.key === 'Escape') close(); };
      overlay.addEventListener('click', close);
      document.addEventListener('keydown', onEsc);
      document.body.appendChild(overlay);
    }

    diningWrap.querySelectorAll('button[aria-label^="Phóng to ảnh:"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const img = btn.querySelector('img');
        if (img) openDiningLightbox(img.src, img.alt);
      });
    });

    diningWrap.querySelectorAll('button').forEach((btn) => {
      if (btn.textContent && btn.textContent.includes('Xem ảnh menu gốc')) {
        btn.addEventListener('click', () => {
          openDiningLightbox('./assets/img/seeme/food-menu-official.jpg', 'Ảnh thực đơn tối chính thức SEEME Homestay');
        });
      }
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
