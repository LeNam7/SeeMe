import { computeHoursUntilCheckIn, enumerateNights, getDayOfWeek } from './dates';
import type {
  CancellationPolicySnapshot,
  NightlyBreakdownItem,
  PolicySettingsConfig,
} from '@/db/schema';

export interface PricingRuleRecord {
  id: number;
  name: string;
  ruleType: string; // 'WEEKDAY' | 'WEEKEND' | 'SEASONAL' | 'HOLIDAY' | 'OVERRIDE'
  roomId: number | null;
  startDate: string;
  endDate: string;
  daysOfWeek: number[] | null;
  priceMode: string; // 'FIXED' | 'PERCENT_MULTIPLIER' | 'AMOUNT_DELTA'
  amount: number;
  priority: number;
  isActive: boolean;
}

export interface RoomPricingInput {
  id: number;
  baseWeekdayPrice: number;
  baseWeekendPrice: number;
}

/**
 * Deterministic Pricing Precedence (highest wins):
 * 1. OVERRIDE (Admin Calendar per-date/room override)
 * 2. HOLIDAY  (Lễ/Tết periods; also triggers holiday non-refundable flag)
 * 3. SEASONAL (Mùa hoa / mùa cao điểm)
 * 4. WEEKEND  (Matching weekend rule or room.baseWeekendPrice for configured weekendDays)
 * 5. WEEKDAY  (Matching weekday rule or room.baseWeekdayPrice)
 * Within the same tier, room-specific rule outranks global rule (roomId === null),
 * and higher `priority` outranks lower `priority`, then newer `id`.
 */
const TIER_RANK: Record<string, number> = {
  OVERRIDE: 500,
  HOLIDAY: 400,
  SEASONAL: 300,
  WEEKEND: 200,
  WEEKDAY: 100,
};

function applyPriceMode(basePrice: number, priceMode: string, amount: number): number {
  if (priceMode === 'FIXED') return Math.max(0, Math.round(amount));
  if (priceMode === 'PERCENT_MULTIPLIER') return Math.max(0, Math.round((basePrice * amount) / 100));
  if (priceMode === 'AMOUNT_DELTA') return Math.max(0, Math.round(basePrice + amount));
  return basePrice;
}

export function priceForNight(
  room: RoomPricingInput,
  nightDate: string,
  rules: PricingRuleRecord[],
  weekendDays: number[] = [5, 6]
): NightlyBreakdownItem {
  const dow = getDayOfWeek(nightDate);
  const isWeekend = weekendDays.includes(dow);
  const basePrice = isWeekend ? room.baseWeekendPrice : room.baseWeekdayPrice;

  const matching = rules.filter((r) => {
    if (!r.isActive) return false;
    if (r.roomId !== null && r.roomId !== room.id) return false;
    if (nightDate < r.startDate || nightDate > r.endDate) return false;
    if (Array.isArray(r.daysOfWeek) && r.daysOfWeek.length > 0 && !r.daysOfWeek.includes(dow)) {
      return false;
    }
    return true;
  });

  const isHoliday = matching.some((r) => r.ruleType === 'HOLIDAY');

  if (matching.length === 0) {
    return {
      date: nightDate,
      price: basePrice,
      ruleName: isWeekend ? 'Giá cuối tuần tiêu chuẩn' : 'Giá ngày thường tiêu chuẩn',
      ruleType: isWeekend ? 'WEEKEND' : 'WEEKDAY',
      isHoliday: false,
    };
  }

  matching.sort((a, b) => {
    const rankDiff = (TIER_RANK[b.ruleType] || 0) - (TIER_RANK[a.ruleType] || 0);
    if (rankDiff !== 0) return rankDiff;
    const specDiff = (b.roomId !== null ? 1 : 0) - (a.roomId !== null ? 1 : 0);
    if (specDiff !== 0) return specDiff;
    const prioDiff = (b.priority || 0) - (a.priority || 0);
    if (prioDiff !== 0) return prioDiff;
    return b.id - a.id;
  });

  const winner = matching[0];
  return {
    date: nightDate,
    price: applyPriceMode(basePrice, winner.priceMode, winner.amount),
    ruleName: winner.name,
    ruleType: winner.ruleType,
    isHoliday,
  };
}

export function calculateStayNightlyBreakdown(
  room: RoomPricingInput,
  checkInDate: string,
  checkOutDate: string,
  rules: PricingRuleRecord[],
  weekendDays: number[] = [5, 6]
): { nights: NightlyBreakdownItem[]; unitSubtotal: number; containsHoliday: boolean } {
  const nightDates = enumerateNights(checkInDate, checkOutDate);
  const nights = nightDates.map((d) => priceForNight(room, d, rules, weekendDays));
  const unitSubtotal = nights.reduce((sum, n) => sum + n.price, 0);
  const containsHoliday = nights.some((n) => n.isHoliday);
  return { nights, unitSubtotal, containsHoliday };
}

/**
 * Evaluates exact cancellation policy at checkout (and anytime a cancellation refund quote is checked).
 * Explicitly resolves intersecting boundaries at day 3, day 7, holidays, and group >=3 / whole house.
 */
export function evaluateCancellationPolicy(params: {
  policy: PolicySettingsConfig;
  checkInDate: string;
  containsHoliday: boolean;
  roomsCount: number;
  isWholeHouse: boolean;
  referenceTime?: Date;
}): CancellationPolicySnapshot {
  const { policy, checkInDate, containsHoliday, roomsCount, isWholeHouse, referenceTime } = params;
  const hoursLeft = computeHoursUntilCheckIn(checkInDate, policy.checkInTime, referenceTime);
  const daysUntilCheckIn = Math.floor((hoursLeft / 24) * 10) / 10;
  const isGroupOrWholeHouse = isWholeHouse || roomsCount >= policy.groupRoomThreshold;

  if (containsHoliday && policy.holidayNonRefundable) {
    return {
      config: policy,
      daysUntilCheckIn,
      containsHoliday: true,
      isGroupOrWholeHouse,
      applicableTierLabel: 'Kỳ nghỉ Lễ / Tết — Không hoàn, không đổi ngày',
      applicableRefundPercent: 0,
      summaryText:
        'Lưu trú rơi vào giai đoạn Lễ/Tết: mất 100% tiền phòng nếu hủy hoặc đổi ngày.',
    };
  }

  if (isGroupOrWholeHouse) {
    const eligible = hoursLeft >= policy.groupMinNoticeDays * 24;
    return {
      config: policy,
      daysUntilCheckIn,
      containsHoliday: false,
      isGroupOrWholeHouse: true,
      applicableTierLabel: eligible
        ? `Đặt nhóm (>= ${policy.groupRoomThreshold} phòng / nguyên căn) — còn đủ hạn báo trước ${policy.groupMinNoticeDays} ngày`
        : `Đặt nhóm (>= ${policy.groupRoomThreshold} phòng / nguyên căn) — dưới mốc báo trước ${policy.groupMinNoticeDays} ngày`,
      applicableRefundPercent: eligible ? 100 : 0,
      summaryText: `Khách đặt từ ${policy.groupRoomThreshold} phòng trở lên hoặc nguyên căn phải báo hủy/đổi trước tối thiểu ${policy.groupMinNoticeDays} ngày (tính theo 14:00 ngày nhận phòng).`,
    };
  }

  // Standard intersection boundary handling (exact hour cutoffs relative to check-in 14:00 VN)
  const fullHours = policy.fullRefundDaysBefore * 24;       // default 7d = 168h
  const partialHours = policy.partialRefundDaysBefore * 24; // default 3d = 72h

  if (hoursLeft >= fullHours) {
    return {
      config: policy,
      daysUntilCheckIn,
      containsHoliday: false,
      isGroupOrWholeHouse: false,
      applicableTierLabel: `Từ đủ ${policy.fullRefundDaysBefore} ngày trở lên (>= ${fullHours} giờ) — Hoàn 100%`,
      applicableRefundPercent: 100,
      summaryText: `Hủy/đổi trước tối thiểu ${policy.fullRefundDaysBefore} ngày (bao gồm đúng mốc ${policy.fullRefundDaysBefore} ngày) được hoàn 100% tiền phòng.`,
    };
  }

  if (hoursLeft >= partialHours) {
    return {
      config: policy,
      daysUntilCheckIn,
      containsHoliday: false,
      isGroupOrWholeHouse: false,
      applicableTierLabel: `Từ đủ ${policy.partialRefundDaysBefore} đến dưới ${policy.fullRefundDaysBefore} ngày — Hoàn ${policy.partialRefundPercent}%`,
      applicableRefundPercent: policy.partialRefundPercent,
      summaryText: `Hủy/đổi trong khoảng từ đúng mốc ${policy.partialRefundDaysBefore} ngày đến dưới ${policy.fullRefundDaysBefore} ngày được hoàn ${policy.partialRefundPercent}% tiền phòng.`,
    };
  }

  return {
    config: policy,
    daysUntilCheckIn,
    containsHoliday: false,
    isGroupOrWholeHouse: false,
    applicableTierLabel: `Dưới ${policy.noRefundUnderDays} ngày (< ${partialHours} giờ) — Không hoàn tiền phòng`,
    applicableRefundPercent: 0,
    summaryText: `Hủy/đổi trong vòng dưới ${policy.noRefundUnderDays} ngày so với 14:00 ngày nhận phòng sẽ không được hoàn tiền phòng.`,
  };
}
