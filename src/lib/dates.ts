const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function getTodayVnDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getDayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
}

export function enumerateNights(checkIn: string, checkOut: string): string[] {
  if (!isValidIsoDate(checkIn) || !isValidIsoDate(checkOut) || checkOut <= checkIn) {
    return [];
  }
  const nights: string[] = [];
  let cursor = checkIn;
  let guard = 0;
  while (cursor < checkOut && guard < 120) {
    nights.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return nights;
}

export function diffDays(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86_400_000);
}

/**
 * Checks whether [startA, endA) and [startB, endB) overlap.
 * Same-day check-out / check-in (e.g. A ends 2026-05-03 and B starts 2026-05-03) does NOT overlap.
 */
export function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
}

export function formatDateVi(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function computeHoursUntilCheckIn(
  checkInIso: string,
  checkInHourMin: string,
  now = new Date()
): number {
  const [hh, mm] = checkInHourMin.split(':').map((n) => Number(n) || 0);
  // Vietnam GMT+7 offset (+07:00)
  const targetIso = `${checkInIso}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`;
  const targetMs = new Date(targetIso).getTime();
  return (targetMs - now.getTime()) / 3_600_000;
}
