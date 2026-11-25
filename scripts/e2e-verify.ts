import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { addDays, getTodayVnDate } from '../src/lib/dates';
import { evaluateCancellationPolicy, priceForNight } from '../src/lib/pricing';
import { DEFAULT_POLICY_SETTINGS } from '../src/lib/settings';

// Load .env / .env.local if present so E2E matches live Next.js server secrets
for (const envFile of ['.env', '.env.local']) {
  const full = path.join(process.cwd(), envFile);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const BASE = 'http://127.0.0.1:3000';
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET?.trim() || 'seemee-webhook-dev-secret';

function signWebhook(bodyStr: string) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(bodyStr).digest('hex');
}

async function runTests() {
  console.log('=== STARTING SEEME END-TO-END VERIFICATION ===');

  // Pick a guaranteed free 12-night window dynamically from live DB so repeated runs stay deterministic
  const today = getTodayVnDate();
  const scanStart = addDays(today, 30);
  const scanEnd = addDays(scanStart, 90);
  const scanRes = await fetch(`${BASE}/api/availability?checkIn=${scanStart}&checkOut=${scanEnd}`);
  const scanData = await scanRes.json();
  const scanHoaLe = scanData.rooms.find((r: { slug: string }) => r.slug === 'hoa-le');
  let freeStartIdx = 0;
  for (let i = 0; i < scanHoaLe.dates.length - 12; i++) {
    const slice = scanHoaLe.dates.slice(i, i + 12);
    if (slice.every((d: { remainingUnits: number }) => d.remainingUnits >= 1)) {
      freeStartIdx = i;
      break;
    }
  }
  const dIn = scanHoaLe.dates[freeStartIdx].date;
  const dMid = addDays(dIn, 2);
  const dOut = addDays(dIn, 4);
  const offset = 30 + freeStartIdx;

  // 0. Health Check
  const healthRes = await fetch(`${BASE}/api/health`);
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.ok, true);
  assert.ok(health.roomsCount >= 4);
  console.log('[PASS] Test 0: Health & DB Schema', health);

  // 0.5 Unit Verification: Policy Boundaries (exact 3d, 7d, holiday, group) & Pricing Precedence
  const pRef = new Date(`${dIn}T14:00:00+07:00`);
  const exact7d = evaluateCancellationPolicy({
    policy: DEFAULT_POLICY_SETTINGS,
    checkInDate: dIn,
    containsHoliday: false,
    roomsCount: 1,
    isWholeHouse: false,
    referenceTime: new Date(pRef.getTime() - 7 * 86_400_000),
  });
  assert.equal(exact7d.applicableRefundPercent, 100, 'Exact 7d must yield 100%');

  const exact3d = evaluateCancellationPolicy({
    policy: DEFAULT_POLICY_SETTINGS,
    checkInDate: dIn,
    containsHoliday: false,
    roomsCount: 1,
    isWholeHouse: false,
    referenceTime: new Date(pRef.getTime() - 3 * 86_400_000),
  });
  assert.equal(exact3d.applicableRefundPercent, 50, 'Exact 3d must yield 50%');

  const under3d = evaluateCancellationPolicy({
    policy: DEFAULT_POLICY_SETTINGS,
    checkInDate: dIn,
    containsHoliday: false,
    roomsCount: 1,
    isWholeHouse: false,
    referenceTime: new Date(pRef.getTime() - 48 * 3_600_000),
  });
  assert.equal(under3d.applicableRefundPercent, 0, 'Under 3d must yield 0%');

  const holidayTier = evaluateCancellationPolicy({
    policy: DEFAULT_POLICY_SETTINGS,
    checkInDate: dIn,
    containsHoliday: true,
    roomsCount: 1,
    isWholeHouse: false,
    referenceTime: new Date(pRef.getTime() - 30 * 86_400_000),
  });
  assert.equal(holidayTier.applicableRefundPercent, 0, 'Holiday overrides lead time -> 0%');

  const groupUnder14 = evaluateCancellationPolicy({
    policy: DEFAULT_POLICY_SETTINGS,
    checkInDate: dIn,
    containsHoliday: false,
    roomsCount: 3,
    isWholeHouse: false,
    referenceTime: new Date(pRef.getTime() - 10 * 86_400_000),
  });
  assert.equal(groupUnder14.applicableRefundPercent, 0, 'Group >=3 rooms under 14d -> 0%');

  const nightTest = priceForNight(
    { id: 1, baseWeekdayPrice: 950_000, baseWeekendPrice: 1_150_000 },
    '2027-01-01',
    [
      {
        id: 1,
        name: 'Season',
        ruleType: 'SEASONAL',
        roomId: null,
        startDate: '2027-01-01',
        endDate: '2027-01-05',
        daysOfWeek: null,
        priceMode: 'FIXED',
        amount: 1_000_000,
        priority: 10,
        isActive: true,
      },
      {
        id: 2,
        name: 'Holiday',
        ruleType: 'HOLIDAY',
        roomId: null,
        startDate: '2027-01-01',
        endDate: '2027-01-02',
        daysOfWeek: null,
        priceMode: 'FIXED',
        amount: 1_300_000,
        priority: 5,
        isActive: true,
      },
      {
        id: 3,
        name: 'Override',
        ruleType: 'OVERRIDE',
        roomId: 1,
        startDate: '2027-01-01',
        endDate: '2027-01-01',
        daysOfWeek: null,
        priceMode: 'FIXED',
        amount: 1_550_000,
        priority: 1,
        isActive: true,
      },
    ]
  );
  assert.equal(nightTest.price, 1_550_000, 'OVERRIDE must win over HOLIDAY and SEASONAL');
  assert.equal(nightTest.isHoliday, true, 'Holiday flag preserved alongside Override');
  console.log('[PASS] Policy Boundary & Pricing Precedence Assertions');

  // Admin Login first (via HTTP API — single server holds PGlite lock cleanly!)
  console.log('[TRACE] Checking unauth /api/admin/dashboard...');
  const unauthDash = await fetch(`${BASE}/api/admin/dashboard`);
  assert.equal(unauthDash.status, 401, 'Unauthenticated admin API must return 401');

  console.log('[TRACE] Logging into /api/admin/login...');
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'seemee-admin-change-me',
    }),
  });
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const cookieHeader = setCookie.split(';')[0];
  assert.ok(cookieHeader.includes('seemee_admin_session='));

  console.log('[TRACE] Fetching availability & services...');
  // Fetch room & service IDs via HTTP
  const availRes = await fetch(`${BASE}/api/availability?checkIn=${dIn}&checkOut=${dOut}`);
  const availData = await availRes.json();
  const roomHoaLe = availData.rooms.find((r: { slug: string }) => r.slug === 'hoa-le');
  const roomAnhDao = availData.rooms.find((r: { slug: string }) => r.slug === 'anh-dao');
  assert.ok(roomHoaLe && roomAnhDao);

  const svcsRes = await fetch(`${BASE}/api/admin/services`, { headers: { Cookie: cookieHeader } });
  const { services: svcs } = await svcsRes.json();
  const hotpotSvc = svcs.find((s: { slug: string }) => s.slug === 'set-lau-bo');
  const coalSvc = svcs.find((s: { slug: string }) => s.slug === 'than-cui-bep-lua');
  assert.ok(hotpotSvc && coalSvc);

  console.log('[TRACE] Testing quote & booking creation...');

  // TEST 1: Policy checkbox enforcement + Booking with Extra Services + Server Recalculation
  const badPolicyRes = await fetch(`${BASE}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checkInDate: dIn,
      checkOutDate: dMid,
      guestsCount: 2,
      roomSelections: [{ roomId: roomHoaLe.roomId, quantity: 1 }],
      serviceSelections: [{ serviceId: hotpotSvc.id, quantity: 2 }],
      customerName: 'Nguyễn Test One',
      customerPhone: '0911111222',
      cancellationPolicyAgreed: false,
    }),
  });
  assert.equal(badPolicyRes.status, 400, 'Must block booking without policy agreement');

  const quoteRes = await fetch(`${BASE}/api/pricing/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checkInDate: dIn,
      checkOutDate: dMid,
      guestsCount: 2,
      roomSelections: [{ roomId: roomHoaLe.roomId, quantity: 1 }],
      serviceSelections: [
        { serviceId: hotpotSvc.id, quantity: 2 },
        { serviceId: coalSvc.id, quantity: 1 },
      ],
    }),
  });
  assert.equal(quoteRes.status, 200);
  const quoteJson = await quoteRes.json();
  assert.equal(
    quoteJson.servicesSubtotal,
    hotpotSvc.price * 2 + coalSvc.price,
    'Extra service subtotal must match server price * qty'
  );
  assert.equal(
    quoteJson.totalAmount,
    quoteJson.roomSubtotal + quoteJson.servicesSubtotal,
    'Total must equal Room + Extra Services'
  );

  // TEST 2: Concurrent Double-Booking Prevention & Same-day Checkout Turnaround
  const payloadA = {
    checkInDate: dIn,
    checkOutDate: dMid,
    guestsCount: 2,
    roomSelections: [{ roomId: roomHoaLe.roomId, quantity: 1 }],
    serviceSelections: [
      { serviceId: hotpotSvc.id, quantity: 2 },
      { serviceId: coalSvc.id, quantity: 1 },
    ],
    customerName: 'Nguyễn Minh Khôi',
    customerPhone: '0987654321',
    customerEmail: 'khoi@test.local',
    expectedCheckInTime: '15:30',
    roomPrepNotes: 'Chuẩn bị thêm ấm trà nóng',
    specialNotes: 'Đến tối muộn',
    consultationTopics: ['Thuê xe máy', 'Tư vấn lịch trình Lũng Cú – Mốc Cực Bắc'],
    consultationQuestion: 'Đường từ Đồng Văn lên bản dễ đi xe số không ạ?',
    cancellationPolicyAgreed: true,
  };

  const [res1, res2] = await Promise.all([
    fetch(`${BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadA),
    }),
    fetch(`${BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payloadA,
        customerName: 'Trần Tranh Lịch',
        customerPhone: '0987654322',
      }),
    }),
  ]);
  const statuses = [res1.status, res2.status].sort();
  assert.deepEqual(
    statuses,
    [201, 409],
    'One concurrent booking must succeed (201) and one reject (409)'
  );
  const winnerRes = res1.status === 201 ? res1 : res2;
  const booking1 = await winnerRes.json();
  assert.equal(booking1.booking.totalAmount, quoteJson.totalAmount);
  assert.equal(
    booking1.booking.status,
    'AWAITING_PAYMENT',
    'New booking must start directly in AWAITING_PAYMENT without manual approval'
  );
  assert.ok(booking1.payment, 'VietQR payment must be created immediately on booking');
  console.log(
    '[PASS] Test 1 & 2a: Direct Payment Hold + Services + Concurrent Double-Booking Rejected:',
    booking1.booking.bookingCode
  );

  // Non-overlapping same-day turnover check (dMid -> dOut) must SUCCEED
  const turnoverRes = await fetch(`${BASE}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checkInDate: dMid,
      checkOutDate: dOut,
      guestsCount: 2,
      roomSelections: [{ roomId: roomHoaLe.roomId, quantity: 1 }],
      serviceSelections: [],
      customerName: 'Lê Nối Chuyến',
      customerPhone: '0912000111',
      cancellationPolicyAgreed: true,
    }),
  });
  assert.equal(turnoverRes.status, 201, 'Same-day check-out / check-in turnover must succeed');
  const bookingTurnover = await turnoverRes.json();

  // Hold Expiry test: expire bookingTurnover via Admin FORCE_EXPIRE action -> verifies expireStaleHolds() frees availability!
  const expActionRes = await fetch(`${BASE}/api/admin/bookings/${bookingTurnover.booking.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ action: 'FORCE_EXPIRE' }),
  });
  assert.equal(expActionRes.status, 200);
  const expActionJson = await expActionRes.json();
  assert.equal(expActionJson.booking.status, 'EXPIRED');

  const postExpiryAvail = await (
    await fetch(`${BASE}/api/availability?checkIn=${dMid}&checkOut=${dOut}`)
  ).json();
  const hoaLePostExpiry = postExpiryAvail.rooms.find((r: { slug: string }) => r.slug === 'hoa-le');
  assert.equal(hoaLePostExpiry.availableUnitsForStay, 1, 'Expired hold must release availability');
  console.log('[PASS] Test 2b: Same-day turnover & Expired Hold release verified');

  // TEST 3: Direct VietQR Availability + Calendar Block/Unblock, Price Override
  // Booking1 already entered AWAITING_PAYMENT directly without any manual approval step
  assert.equal(booking1.booking.status, 'AWAITING_PAYMENT');

  // Calendar Block + Unblock + Price Override on Anh Dao
  const testDate = addDays(today, offset + 10);
  await fetch(`${BASE}/api/admin/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      action: 'BLOCK_DATE',
      roomId: roomAnhDao.roomId,
      date: testDate,
      note: 'Khóa test bảo trì',
    }),
  });
  const blockedAvail = await (
    await fetch(`${BASE}/api/availability?checkIn=${testDate}&checkOut=${addDays(testDate, 1)}`)
  ).json();
  assert.equal(
    blockedAvail.rooms.find((r: { roomId: number }) => r.roomId === roomAnhDao.roomId)
      .availableUnitsForStay,
    0
  );

  await fetch(`${BASE}/api/admin/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      action: 'UNBLOCK_DATE',
      roomId: roomAnhDao.roomId,
      date: testDate,
    }),
  });
  await fetch(`${BASE}/api/admin/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      action: 'PRICE_OVERRIDE',
      roomId: roomAnhDao.roomId,
      date: testDate,
      overridePrice: 1_990_000,
    }),
  });
  const overriddenAvail = await (
    await fetch(`${BASE}/api/availability?checkIn=${testDate}&checkOut=${addDays(testDate, 1)}`)
  ).json();
  assert.equal(
    overriddenAvail.rooms.find((r: { roomId: number }) => r.roomId === roomAnhDao.roomId).dates[0]
      .price,
    1_990_000
  );
  await fetch(`${BASE}/api/admin/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      action: 'CLEAR_PRICE_OVERRIDE',
      roomId: roomAnhDao.roomId,
      date: testDate,
    }),
  });
  console.log('[PASS] Test 3: Admin Auth, Approve -> VietQR, Calendar Block/Override verified');

  // TEST 4: VietQR Payload Check + Webhook HMAC Signature + Amount Mismatch Rejection + Idempotency
  const bkViewRes = await fetch(`${BASE}/api/bookings/${booking1.booking.bookingCode}`);
  const bkView = await bkViewRes.json();
  assert.ok(bkView.payment && bkView.payment.qrPayload.includes(booking1.booking.bookingCode));
  assert.equal(bkView.payment.amount, booking1.booking.totalAmount);

  const forgedBody = JSON.stringify({
    transactionRef: `TX-FORGE-${Date.now()}`,
    bookingCode: booking1.booking.bookingCode,
    amount: booking1.booking.totalAmount,
  });
  const forgedRes = await fetch(`${BASE}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-seemee-signature': 'deadbeef' },
    body: forgedBody,
  });
  assert.equal(forgedRes.status, 401);

  const mismatchBody = JSON.stringify({
    transactionRef: `TX-MISMATCH-${Date.now()}`,
    bookingCode: booking1.booking.bookingCode,
    amount: booking1.booking.totalAmount - 50_000,
  });
  const mismatchRes = await fetch(`${BASE}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-seemee-signature': signWebhook(mismatchBody),
    },
    body: mismatchBody,
  });
  assert.equal(mismatchRes.status, 422);

  const exactTxRef = `VCB-${Date.now()}`;
  const validBody = JSON.stringify({
    transactionRef: exactTxRef,
    bookingCode: booking1.booking.bookingCode,
    amount: booking1.booking.totalAmount,
    transferContent: `SEEME ${booking1.booking.bookingCode}`,
  });
  const validRes = await fetch(`${BASE}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-seemee-signature': signWebhook(validBody),
    },
    body: validBody,
  });
  assert.equal(validRes.status, 200);
  const validJson = await validRes.json();
  assert.equal(validJson.status, 'CONFIRMED');

  // Verify confirmed booking keeps the exact room dates reserved in DB
  const confirmedAvail = await (
    await fetch(`${BASE}/api/availability?checkIn=${dIn}&checkOut=${dMid}`)
  ).json();
  assert.equal(
    confirmedAvail.rooms.find((r: { roomId: number }) => r.roomId === roomHoaLe.roomId)
      .availableUnitsForStay,
    0,
    'Confirmed booking must remain held in DB for exact check-in to check-out range'
  );

  const dupRes = await fetch(`${BASE}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-seemee-signature': signWebhook(validBody),
    },
    body: validBody,
  });
  assert.equal(dupRes.status, 200);
  const dupJson = await dupRes.json();
  assert.equal(dupJson.status, 'ALREADY_PROCESSED');
  console.log('[PASS] Test 4: VietQR Payload, Webhook HMAC, Mismatch 422, DB Room Hold & Idempotency verified');

  // TEST 5: Zalo Notification Adapter Integrity Check
  const notifRes = await fetch(`${BASE}/api/admin/notifications`, {
    headers: { Cookie: cookieHeader },
  });
  assert.equal(notifRes.status, 200);
  const notifJson = await notifRes.json();
  const forBooking1 = notifJson.logs.filter(
    (l: { bookingId: number }) => l.bookingId === booking1.booking.id
  );
  assert.ok(
    forBooking1.length >= 2,
    'Expected CREATED_OWNER and PAYMENT_CONFIRMED_GUEST logs'
  );
  for (const l of forBooking1) {
    assert.ok(['PENDING_CONFIG', 'SENT', 'FAILED'].includes(l.status));
    if (!process.env.ZALO_OA_ACCESS_TOKEN) {
      assert.equal(l.status, 'PENDING_CONFIG', 'Must never fabricate SENT without OA credentials');
    }
  }
  console.log(
    '[PASS] Test 5: Honest Zalo Notification Adapter logs verified:',
    forBooking1.length,
    'events'
  );

  // TEST 6: Live Playwright Headless Audit + Responsive Visual Verification
  const outShotsDir = path.join(process.cwd(), '.verification-shots');
  fs.mkdirSync(outShotsDir, { recursive: true });

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1217', 'chrome-win64', 'chrome.exe'),
  ];
  const executablePath = chromePaths.find((p) => fs.existsSync(p));
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const viewports = [
      { name: 'desktop-1440', width: 1440, height: 900 },
      { name: 'mobile-390', width: 390, height: 844 },
      { name: 'mobile-320', width: 320, height: 640 },
    ];

    for (const vp of viewports) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedHttp: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text());
      });
      page.on('response', (res) => {
        if (res.status() >= 400 && !res.url().includes('/api/admin/login')) {
          failedHttp.push(`${res.status()} ${res.url()}`);
        }
      });
      page.on('pageerror', (e) => pageErrors.push(e.message));

      // Homepage
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(500);
      await page.waitForSelector('#av-guests', { timeout: 10_000 });
      await page.fill('#av-guests', '4');
      assert.equal(await page.inputValue('#av-guests'), '4');
      await page.fill('#av-guests', '2');
      assert.equal(await page.inputValue('#av-guests'), '2');
      // Scroll through page so lazy-loaded frames & scroll moments decode cleanly before full-page screenshot
      if (vp.name === 'desktop-1440') {
        await page.screenshot({ path: path.join(outShotsDir, `home-${vp.name}.png`), fullPage: false });
        const totalH = await page.evaluate(() => document.body.scrollHeight);
        for (let y = 0; y <= totalH; y += 700) {
          await page.evaluate((pos) => window.scrollTo(0, pos), y);
          await page.waitForTimeout(180);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await page.screenshot({
          path: path.join(outShotsDir, `home-full-${vp.name}.png`),
          fullPage: true,
        });
      } else {
        await page.screenshot({ path: path.join(outShotsDir, `home-${vp.name}.png`), fullPage: false });
      }
      const overflowHome = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      assert.equal(overflowHome, false, `Horizontal overflow detected on / at ${vp.name}`);

      const brokenImgs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('img')).filter(
          (im) => !im.complete || im.naturalWidth === 0
        ).length
      );
      assert.equal(brokenImgs, 0, `Broken <img> found on / at ${vp.name}`);

      // Room Detail Page (/rooms/hoa-le)
      await page.goto(`${BASE}/rooms/hoa-le`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const overflowRoom = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      assert.equal(overflowRoom, false, `Horizontal overflow on /rooms/hoa-le at ${vp.name}`);
      await page.screenshot({ path: path.join(outShotsDir, `room-${vp.name}.png`), fullPage: false });

      // Multi-room Booking Page (/book) + Guest Stepper Manual Entry / Buttons
      await page.goto(`${BASE}/book`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#booking-guests', { timeout: 10_000 });
      await page.fill('#booking-guests', '6');
      assert.equal(await page.inputValue('#booking-guests'), '6');
      await page.locator('button[aria-label="Tăng số lượng khách"]').first().click();
      assert.equal(await page.inputValue('#booking-guests'), '7');
      await page.locator('button[aria-label="Giảm số lượng khách"]').first().click();
      assert.equal(await page.inputValue('#booking-guests'), '6');
      await page.waitForTimeout(250);
      await page.locator('button:has-text("Chọn trọn 4 phòng (Nguyên căn)")').click();
      await page.waitForTimeout(300);
      const overflowBook = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      assert.equal(overflowBook, false, `Horizontal overflow on /book at ${vp.name}`);

      // Confirmed Booking Status Page
      await page.goto(`${BASE}/booking/${booking1.booking.bookingCode}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(outShotsDir, `booking-${vp.name}.png`),
        fullPage: false,
      });

      // Admin Login + Redesigned Dashboard + Removed Tabs Check + Matrix Calendar
      await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
      await page.fill('input[type="text"]', process.env.ADMIN_USERNAME || 'admin');
      await page.fill(
        'input[type="password"]',
        process.env.ADMIN_PASSWORD || 'seemee-admin-change-me'
      );
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Đang thanh toán', { timeout: 10_000 });
      await page.waitForTimeout(300);

      assert.equal(await page.locator('button:has-text("Giá & Lễ/Tết")').count(), 0);
      assert.equal(await page.locator('button:has-text("Thanh toán & Zalo")').count(), 0);
      assert.equal(await page.locator('button:has-text("Chờ duyệt")').count(), 0);
      if (vp.name === 'desktop-1440') {
        const navBorder = await page.evaluate(() => {
          const btn = document.querySelector('aside button.admin-nav-active');
          return btn ? getComputedStyle(btn).borderTopWidth : 'missing';
        });
        assert.equal(navBorder, '0px', 'Sidebar nav button must have zero outset border');
      }
      await page.screenshot({
        path: path.join(outShotsDir, `admin-dashboard-${vp.name}.png`),
        fullPage: false,
      });

      for (const tabLabel of ['Đơn đặt', 'Phòng & Ảnh', 'Dịch vụ', 'Cài đặt', 'Lịch phòng']) {
        await page.locator(`button:has-text("${tabLabel}"):visible`).first().click();
        await page.waitForTimeout(200);
        if (vp.name === 'desktop-1440' && tabLabel === 'Đơn đặt') {
          await page.screenshot({
            path: path.join(outShotsDir, `admin-bookings-${vp.name}.png`),
            fullPage: false,
          });
        }
      }
      await page.waitForSelector('table', { timeout: 10_000 });
      const overflowAdmin = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      assert.equal(overflowAdmin, false, `Horizontal overflow on /admin at ${vp.name}`);
      await page.screenshot({
        path: path.join(outShotsDir, `admin-calendar-${vp.name}.png`),
        fullPage: false,
      });

      assert.deepEqual(pageErrors, [], `Uncaught page errors at ${vp.name}: ${pageErrors.join('; ')}`);
      const appErrors = consoleErrors.filter(
        (e) => !e.includes('maps.google') && !e.includes('gstatic')
      );
      assert.deepEqual(
        appErrors,
        [],
        `App console errors at ${vp.name}: ${appErrors.join('; ')} | failedHttp=${failedHttp.join(', ')}`
      );
      await ctx.close();
    }
    console.log('[PASS] Test 6: Playwright Desktop (1440px) & Mobile (390px, 320px) UI/Overflow/Errors verified');
  } finally {
    await browser.close();
  }

  // Verify SEO & Policy Routes return HTTP 200 cleanly
  for (const r of ['/terms', '/privacy', '/credits', '/book', '/sitemap.xml', '/robots.txt']) {
    const resp = await fetch(`${BASE}${r}`);
    assert.equal(resp.status, 200, `Expected 200 on ${r}`);
  }
  console.log('[PASS] Test 7: Legal, Multi-room /book & SEO routes verified (200 OK)');

  console.log('=== ALL E2E TESTS PASSED CLEANLY ===');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('E2E VERIFICATION FAILED:', err);
    process.exit(1);
  });
