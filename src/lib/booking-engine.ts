import { eq, inArray, lt, and, gte } from 'drizzle-orm';
import { db, ensureDbSchema, schema, withSerializedBookingTx, type AppDatabase } from '@/db';
import {
  addDays,
  enumerateNights,
  formatDateVi,
  getTodayVnDate,
  isValidIsoDate,
  rangesOverlap,
} from './dates';
import {
  calculateStayNightlyBreakdown,
  evaluateCancellationPolicy,
  type PricingRuleRecord,
} from './pricing';
import { getAllSiteSettings } from './settings';
import { generateVietQrForBooking } from './vietqr';
import { dispatchZaloNotification } from './zalo';

const ACTIVE_HOLD_STATUSES = ['PENDING', 'APPROVED', 'AWAITING_PAYMENT', 'CONFIRMED'] as const;

export interface RoomSelectionInput {
  roomId: number;
  quantity: number;
}

export interface ExtraServiceSelectionInput {
  serviceId: number;
  quantity: number;
}

export interface CreateBookingInput {
  checkInDate: string;
  checkOutDate: string;
  guestsCount: number;
  roomSelections: RoomSelectionInput[];
  serviceSelections: ExtraServiceSelectionInput[];
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  expectedCheckInTime?: string;
  roomPrepNotes?: string;
  specialNotes?: string;
  consultationTopics?: string[];
  consultationQuestion?: string;
  cancellationPolicyAgreed: boolean;
}

export class BookingError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = 'BOOKING_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function generateBookingCode(): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SM${yy}${mm}${dd}-${rand}`;
}

export async function expireStaleHolds(txOrDb: AppDatabase = db): Promise<number> {
  const now = new Date();
  const expired = await txOrDb
    .select()
    .from(schema.bookings)
    .where(
      and(
        inArray(schema.bookings.status, ['PENDING', 'APPROVED', 'AWAITING_PAYMENT']),
        lt(schema.bookings.holdExpiresAt, now)
      )
    );

  if (expired.length === 0) return 0;

  for (const b of expired) {
    await txOrDb
      .update(schema.bookings)
      .set({
        status: 'EXPIRED',
        paymentStatus: b.paymentStatus === 'AWAITING_TRANSFER' ? 'EXPIRED' : b.paymentStatus,
        updatedAt: now,
      })
      .where(eq(schema.bookings.id, b.id));

    await txOrDb
      .update(schema.payments)
      .set({ status: 'EXPIRED', updatedAt: now })
      .where(and(eq(schema.payments.bookingId, b.id), eq(schema.payments.status, 'AWAITING_TRANSFER')));

    await txOrDb.insert(schema.bookingStatusHistory).values({
      bookingId: b.id,
      fromStatus: b.status,
      toStatus: 'EXPIRED',
      actorType: 'SYSTEM',
      actorName: 'Hệ thống giữ chỗ',
      note: 'Tự động hết hạn giữ phòng do quá thời hạn xác nhận hoặc thanh toán, lịch phòng đã được mở lại.',
    });
  }

  return expired.length;
}

export async function getAvailabilityForRange(
  startDate: string,
  endDate: string,
  roomIdFilter?: number,
  txOrDb: AppDatabase = db
) {
  await ensureDbSchema();
  await expireStaleHolds(txOrDb);

  const dates = enumerateNights(startDate, endDate);
  const roomRows = await txOrDb
    .select()
    .from(schema.rooms)
    .where(
      roomIdFilter
        ? and(eq(schema.rooms.isActive, true), eq(schema.rooms.id, roomIdFilter))
        : eq(schema.rooms.isActive, true)
    );

  const activeBookings = await txOrDb
    .select()
    .from(schema.bookings)
    .where(
      and(
        inArray(schema.bookings.status, [...ACTIVE_HOLD_STATUSES]),
        gte(schema.bookings.checkOutDate, startDate)
      )
    );

  const bookingIds = activeBookings.map((b) => b.id);
  const items =
    bookingIds.length > 0
      ? await txOrDb
          .select()
          .from(schema.bookingItems)
          .where(inArray(schema.bookingItems.bookingId, bookingIds))
      : [];

  const blocks = await txOrDb.select().from(schema.availabilityBlocks);
  const rules = (await txOrDb
    .select()
    .from(schema.pricingRules)) as PricingRuleRecord[];
  const settings = await getAllSiteSettings(txOrDb);

  const bookingById = new Map(activeBookings.map((b) => [b.id, b]));

  const roomAvailability = roomRows.map((room) => {
    const roomItems = items.filter((it) => it.roomId === room.id);
    const roomBlocks = blocks.filter((bl) => bl.roomId === room.id);

    let minAvailable = room.totalUnits;
    const perDate = dates.map((d) => {
      let bookedUnits = 0;
      const matchingBookings: { id: number; code: string; status: string; customerName: string }[] = [];
      for (const item of roomItems) {
        const bk = bookingById.get(item.bookingId);
        if (!bk) continue;
        if (d >= bk.checkInDate && d < bk.checkOutDate) {
          bookedUnits += item.quantity;
          matchingBookings.push({
            id: bk.id,
            code: bk.bookingCode,
            status: bk.status,
            customerName: bk.customerName,
          });
        }
      }

      const block = roomBlocks.find((bl) => bl.blockDate === d);
      const blockedUnits = block ? block.unitsBlocked : 0;
      const remainingUnits = Math.max(0, room.totalUnits - bookedUnits - blockedUnits);
      if (remainingUnits < minAvailable) minAvailable = remainingUnits;

      const pricing = calculateStayNightlyBreakdown(
        room,
        d,
        addDays(d, 1),
        rules,
        settings.workflow.weekendDays
      ).nights[0];

      let cellStatus: 'AVAILABLE' | 'PENDING' | 'CONFIRMED' | 'UNAVAILABLE' = 'AVAILABLE';
      if (blockedUnits >= room.totalUnits) {
        cellStatus = 'UNAVAILABLE';
      } else if (matchingBookings.some((b) => b.status === 'CONFIRMED')) {
        cellStatus = remainingUnits === 0 ? 'CONFIRMED' : 'AVAILABLE';
      } else if (matchingBookings.length > 0 && remainingUnits === 0) {
        cellStatus = 'PENDING';
      } else if (remainingUnits === 0) {
        cellStatus = 'UNAVAILABLE';
      }

      return {
        date: d,
        remainingUnits,
        bookedUnits,
        blockedUnits,
        blockReason: block?.reason || null,
        blockNote: block?.note || null,
        status: cellStatus,
        price: pricing?.price ?? room.baseWeekdayPrice,
        ruleType: pricing?.ruleType ?? 'WEEKDAY',
        ruleName: pricing?.ruleName ?? '',
        isHoliday: pricing?.isHoliday ?? false,
        bookings: matchingBookings,
      };
    });

    return {
      roomId: room.id,
      slug: room.slug,
      name: room.name,
      totalUnits: room.totalUnits,
      standardCapacity: room.standardCapacity,
      maxCapacity: room.maxCapacity,
      availableUnitsForStay: dates.length > 0 ? minAvailable : room.totalUnits,
      dates: perDate,
    };
  });

  return {
    startDate,
    endDate,
    nightsCount: dates.length,
    rooms: roomAvailability,
  };
}

export const EXTRA_GUEST_FEE_PER_NIGHT = 100_000;

export async function calculateBookingQuote(params: {
  checkInDate: string;
  checkOutDate: string;
  guestsCount: number;
  roomSelections: RoomSelectionInput[];
  serviceSelections: ExtraServiceSelectionInput[];
}) {
  await ensureDbSchema();
  const { checkInDate, checkOutDate, guestsCount, roomSelections, serviceSelections } = params;
  const nights = enumerateNights(checkInDate, checkOutDate);
  if (nights.length === 0) {
    throw new BookingError('Ngày nhận phòng và trả phòng không hợp lệ.', 400, 'INVALID_DATES');
  }

  const today = getTodayVnDate();
  if (checkInDate < today) {
    throw new BookingError('Không thể đặt ngày nhận phòng trong quá khứ.', 400, 'PAST_DATE');
  }

  const cleanRoomSelections = roomSelections.filter((r) => r.quantity > 0);
  if (cleanRoomSelections.length === 0) {
    throw new BookingError('Vui lòng chọn ít nhất một phòng.', 400, 'NO_ROOMS');
  }

  const settings = await getAllSiteSettings();
  const rules = (await db.select().from(schema.pricingRules)) as PricingRuleRecord[];
  const avail = await getAvailabilityForRange(checkInDate, checkOutDate);

  const allRooms = await db.select().from(schema.rooms).where(eq(schema.rooms.isActive, true));
  const roomMap = new Map(allRooms.map((r) => [r.id, r]));

  let baseRoomSubtotal = 0;
  let containsHoliday = false;
  let roomsCount = 0;
  let totalStandardCapacity = 0;
  let totalMaxCapacity = 0;
  const itemsDetail = [];

  for (const sel of cleanRoomSelections) {
    const room = roomMap.get(sel.roomId);
    if (!room) {
      throw new BookingError(`Không tìm thấy phòng mã #${sel.roomId}.`, 404, 'ROOM_NOT_FOUND');
    }
    const availRoom = avail.rooms.find((a) => a.roomId === room.id);
    if (!availRoom || availRoom.availableUnitsForStay < sel.quantity) {
      throw new BookingError(
        `Phòng ${room.name} chỉ còn ${availRoom?.availableUnitsForStay ?? 0} phòng trống trong khoảng ${formatDateVi(
          checkInDate
        )} – ${formatDateVi(checkOutDate)}.`,
        409,
        'ROOM_UNAVAILABLE'
      );
    }
    const breakdown = calculateStayNightlyBreakdown(
      room,
      checkInDate,
      checkOutDate,
      rules,
      settings.workflow.weekendDays
    );
    const subtotal = breakdown.unitSubtotal * sel.quantity;
    baseRoomSubtotal += subtotal;
    roomsCount += sel.quantity;
    totalStandardCapacity += room.standardCapacity * sel.quantity;
    totalMaxCapacity += room.maxCapacity * sel.quantity;
    if (breakdown.containsHoliday) containsHoliday = true;

    itemsDetail.push({
      roomId: room.id,
      slug: room.slug,
      roomName: room.name,
      quantity: sel.quantity,
      nightlyBreakdown: breakdown.nights,
      unitSubtotal: breakdown.unitSubtotal,
      subtotal,
    });
  }

  if (guestsCount > totalMaxCapacity) {
    throw new BookingError(
      `Số khách (${guestsCount}) vượt quá sức chứa tối đa (${totalMaxCapacity} khách) của các phòng đã chọn.`,
      400,
      'CAPACITY_EXCEEDED'
    );
  }

  const extraGuestsCount = Math.max(0, guestsCount - totalStandardCapacity);
  const extraGuestSubtotal = extraGuestsCount * EXTRA_GUEST_FEE_PER_NIGHT * nights.length;
  const roomSubtotal = baseRoomSubtotal + extraGuestSubtotal;

  const allServices = await db
    .select()
    .from(schema.extraServices)
    .where(eq(schema.extraServices.isAvailable, true));
  const serviceMap = new Map(allServices.map((s) => [s.id, s]));

  let servicesSubtotal = 0;
  const servicesDetail = [];
  for (const sSel of serviceSelections.filter((x) => x.quantity > 0)) {
    const svc = serviceMap.get(sSel.serviceId);
    if (!svc) {
      throw new BookingError(
        `Dịch vụ #${sSel.serviceId} hiện không khả dụng.`,
        400,
        'SERVICE_UNAVAILABLE'
      );
    }
    const subtotal = svc.price * sSel.quantity;
    servicesSubtotal += subtotal;
    servicesDetail.push({
      serviceId: svc.id,
      name: svc.name,
      unit: svc.unit,
      unitPrice: svc.price,
      quantity: sSel.quantity,
      subtotal,
    });
  }

  const isWholeHouse = roomsCount >= allRooms.length && allRooms.length >= 4;
  const policySnapshot = evaluateCancellationPolicy({
    policy: settings.policy,
    checkInDate,
    containsHoliday,
    roomsCount,
    isWholeHouse,
  });

  const totalAmount = roomSubtotal + servicesSubtotal;
  return {
    checkInDate,
    checkOutDate,
    nightsCount: nights.length,
    guestsCount,
    roomsCount,
    isWholeHouse,
    baseRoomSubtotal,
    extraGuestsCount,
    extraGuestFeePerNight: EXTRA_GUEST_FEE_PER_NIGHT,
    extraGuestSubtotal,
    roomSubtotal,
    servicesSubtotal,
    totalAmount,
    items: itemsDetail,
    services: servicesDetail,
    policySnapshot,
    workflowMode: settings.workflow.mode,
    paymentSettings: settings.payment,
  };
}

export async function createBookingTransaction(input: CreateBookingInput) {
  if (!input.cancellationPolicyAgreed) {
    throw new BookingError(
      'Vui lòng tích đồng ý với chính sách hoàn/hủy/đổi phòng của Homestay trước khi tiếp tục.',
      400,
      'POLICY_REQUIRED'
    );
  }
  if (!isValidIsoDate(input.checkInDate) || !isValidIsoDate(input.checkOutDate)) {
    throw new BookingError('Định dạng ngày không hợp lệ.', 400, 'INVALID_DATES');
  }

  const cleanPhone = input.customerPhone.replace(/\s+/g, '');
  if (cleanPhone.length < 9) {
    throw new BookingError('Số điện thoại liên hệ chưa hợp lệ.', 400, 'INVALID_PHONE');
  }

  const result = await withSerializedBookingTx(async (tx) => {
    await expireStaleHolds(tx);

    const nights = enumerateNights(input.checkInDate, input.checkOutDate);
    if (nights.length === 0) {
      throw new BookingError('Ngày trả phòng phải sau ngày nhận phòng.', 400, 'INVALID_DATES');
    }

    const today = getTodayVnDate();
    if (input.checkInDate < today) {
      throw new BookingError('Không thể đặt phòng cho ngày đã qua.', 400, 'PAST_DATE');
    }

    const cleanRoomSelections = input.roomSelections.filter((r) => r.quantity > 0);
    if (cleanRoomSelections.length === 0) {
      throw new BookingError('Vui lòng chọn ít nhất một phòng.', 400, 'NO_ROOMS');
    }

    const settings = await getAllSiteSettings(tx);
    const rules = (await tx.select().from(schema.pricingRules)) as PricingRuleRecord[];
    const allRooms = await tx.select().from(schema.rooms).where(eq(schema.rooms.isActive, true));
    const roomMap = new Map(allRooms.map((r) => [r.id, r]));

    // Re-read current active holds and owner blocks inside the SERIALIZABLE transaction
    const existingBookings = await tx
      .select()
      .from(schema.bookings)
      .where(inArray(schema.bookings.status, [...ACTIVE_HOLD_STATUSES]));
    const overlappingIds = existingBookings
      .filter((b) => rangesOverlap(b.checkInDate, b.checkOutDate, input.checkInDate, input.checkOutDate))
      .map((b) => b.id);

    const overlappingItems =
      overlappingIds.length > 0
        ? await tx
            .select()
            .from(schema.bookingItems)
            .where(inArray(schema.bookingItems.bookingId, overlappingIds))
        : [];
    const blocks = await tx.select().from(schema.availabilityBlocks);

    let baseRoomSubtotal = 0;
    let containsHoliday = false;
    let roomsCount = 0;
    let totalStandardCapacity = 0;
    let totalMaxCapacity = 0;
    const itemInserts: Array<{
      roomId: number;
      roomNameSnapshot: string;
      quantity: number;
      nightlyBreakdown: ReturnType<typeof calculateStayNightlyBreakdown>['nights'];
      subtotal: number;
    }> = [];

    for (const sel of cleanRoomSelections) {
      const room = roomMap.get(sel.roomId);
      if (!room) {
        throw new BookingError(`Phòng #${sel.roomId} không tồn tại.`, 404, 'ROOM_NOT_FOUND');
      }

      for (const night of nights) {
        let usedUnits = 0;
        for (const it of overlappingItems) {
          if (it.roomId !== room.id) continue;
          const bk = existingBookings.find((b) => b.id === it.bookingId);
          if (bk && night >= bk.checkInDate && night < bk.checkOutDate) {
            usedUnits += it.quantity;
          }
        }
        const block = blocks.find((bl) => bl.roomId === room.id && bl.blockDate === night);
        const blockedUnits = block ? block.unitsBlocked : 0;
        const remaining = room.totalUnits - usedUnits - blockedUnits;
        if (remaining < sel.quantity) {
          throw new BookingError(
            `Rất tiếc, phòng ${room.name} đã kín lịch trong đêm ${formatDateVi(
              night
            )} (vừa có khách khác giữ chỗ).`,
            409,
            'DOUBLE_BOOKING_PREVENTED'
          );
        }
      }

      const breakdown = calculateStayNightlyBreakdown(
        room,
        input.checkInDate,
        input.checkOutDate,
        rules,
        settings.workflow.weekendDays
      );
      const subtotal = breakdown.unitSubtotal * sel.quantity;
      baseRoomSubtotal += subtotal;
      roomsCount += sel.quantity;
      totalStandardCapacity += room.standardCapacity * sel.quantity;
      totalMaxCapacity += room.maxCapacity * sel.quantity;
      if (breakdown.containsHoliday) containsHoliday = true;

      itemInserts.push({
        roomId: room.id,
        roomNameSnapshot: room.name,
        quantity: sel.quantity,
        nightlyBreakdown: breakdown.nights,
        subtotal,
      });
    }

    if (input.guestsCount > totalMaxCapacity) {
      throw new BookingError(
        `Số khách (${input.guestsCount}) vượt quá sức chứa tối đa (${totalMaxCapacity} khách).`,
        400,
        'CAPACITY_EXCEEDED'
      );
    }

    const extraGuestsCount = Math.max(0, input.guestsCount - totalStandardCapacity);
    const extraGuestSubtotal = extraGuestsCount * EXTRA_GUEST_FEE_PER_NIGHT * nights.length;
    const roomSubtotal = baseRoomSubtotal + extraGuestSubtotal;

    const allServices = await tx
      .select()
      .from(schema.extraServices)
      .where(eq(schema.extraServices.isAvailable, true));
    const serviceMap = new Map(allServices.map((s) => [s.id, s]));

    let servicesSubtotal = 0;
    const serviceInserts: Array<{
      serviceId: number;
      serviceNameSnapshot: string;
      unitPrice: number;
      unit: string;
      quantity: number;
      subtotal: number;
    }> = [];

    for (const sSel of input.serviceSelections.filter((s) => s.quantity > 0)) {
      const svc = serviceMap.get(sSel.serviceId);
      if (!svc) {
        throw new BookingError(`Dịch vụ #${sSel.serviceId} không khả dụng.`, 400, 'SERVICE_UNAVAILABLE');
      }
      const subtotal = svc.price * sSel.quantity;
      servicesSubtotal += subtotal;
      serviceInserts.push({
        serviceId: svc.id,
        serviceNameSnapshot: svc.name,
        unitPrice: svc.price,
        unit: svc.unit,
        quantity: sSel.quantity,
        subtotal,
      });
    }

    const isWholeHouse = roomsCount >= allRooms.length && allRooms.length >= 4;
    const policySnapshot = evaluateCancellationPolicy({
      policy: settings.policy,
      checkInDate: input.checkInDate,
      containsHoliday,
      roomsCount,
      isWholeHouse,
    });

    const totalAmount = roomSubtotal + servicesSubtotal;

    // Upsert Customer
    const existingCustomer = await tx
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.phone, cleanPhone));

    let customerId: number;
    if (existingCustomer.length > 0) {
      customerId = existingCustomer[0].id;
      await tx
        .update(schema.customers)
        .set({
          fullName: input.customerName.trim(),
          email: input.customerEmail?.trim() || existingCustomer[0].email,
          totalBookings: existingCustomer[0].totalBookings + 1,
          lastStayDate: input.checkInDate,
          updatedAt: new Date(),
        })
        .where(eq(schema.customers.id, customerId));
    } else {
      const [createdCustomer] = await tx
        .insert(schema.customers)
        .values({
          fullName: input.customerName.trim(),
          phone: cleanPhone,
          email: input.customerEmail?.trim() || null,
          totalBookings: 1,
          totalSpent: 0,
          lastStayDate: input.checkInDate,
        })
        .returning();
      customerId = createdCustomer.id;
    }

    const workflowMode = 'INSTANT_PAYMENT' as const;
    const bookingCode = generateBookingCode();
    const initialStatus = 'AWAITING_PAYMENT';
    const holdMinutes = settings.policy.holdMinutesPayment;
    const holdExpiresAt = new Date(Date.now() + holdMinutes * 60_000);

    const [booking] = await tx
      .insert(schema.bookings)
      .values({
        bookingCode,
        customerId,
        customerName: input.customerName.trim(),
        customerPhone: cleanPhone,
        customerEmail: input.customerEmail?.trim() || null,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        nights: nights.length,
        guestsCount: input.guestsCount,
        roomsCount,
        isWholeHouse,
        roomSubtotal,
        servicesSubtotal,
        totalAmount,
        status: initialStatus,
        workflowMode,
        paymentStatus: 'AWAITING_TRANSFER',
        expectedCheckInTime: input.expectedCheckInTime?.trim() || null,
        roomPrepNotes: input.roomPrepNotes?.trim() || null,
        specialNotes: input.specialNotes?.trim() || null,
        consultationTopics: input.consultationTopics || [],
        consultationQuestion: input.consultationQuestion?.trim() || null,
        cancellationPolicyAgreed: true,
        cancellationPolicySnapshot: policySnapshot,
        holdExpiresAt,
      })
      .returning();

    for (const item of itemInserts) {
      await tx.insert(schema.bookingItems).values({
        bookingId: booking.id,
        ...item,
      });
    }

    for (const svc of serviceInserts) {
      await tx.insert(schema.bookingServices).values({
        bookingId: booking.id,
        ...svc,
      });
    }

    await tx.insert(schema.bookingStatusHistory).values({
      bookingId: booking.id,
      fromStatus: null,
      toStatus: initialStatus,
      actorType: 'GUEST',
      actorName: input.customerName.trim(),
      note: 'Khách tạo đơn đặt phòng — Đang thanh toán VietQR (tạm giữ phòng đúng lịch đã chọn).',
    });

    const qr = await generateVietQrForBooking({
      bookingCode,
      amount: totalAmount,
      paymentSettings: settings.payment,
    });
    const [createdPay] = await tx
      .insert(schema.payments)
      .values({
        bookingId: booking.id,
        provider: 'VIETQR',
        amount: qr.amount,
        currency: 'VND',
        status: 'AWAITING_TRANSFER',
        qrImageUrl: qr.qrImageUrl,
        qrPayload: qr.qrPayload,
        bankBin: qr.bankBin,
        bankName: qr.bankName,
        accountNo: qr.accountNo,
        accountName: qr.accountName,
        transferContent: qr.transferContent,
        expiresAt: holdExpiresAt,
      })
      .returning();
    const payment = createdPay;

    const roomsSummary = itemInserts.map((x) => `${x.roomNameSnapshot} x${x.quantity}`).join(', ');
    return { booking, items: itemInserts, services: serviceInserts, payment, roomsSummary };
  });

  // Fire Zalo notification adapter cleanly after DB commit (booking never rolls back if Zalo fails)
  await dispatchZaloNotification({
    bookingId: result.booking.id,
    bookingCode: result.booking.bookingCode,
    eventType: 'BOOKING_CREATED_OWNER',
    customerName: result.booking.customerName,
    customerPhone: result.booking.customerPhone,
    checkInDate: result.booking.checkInDate,
    checkOutDate: result.booking.checkOutDate,
    totalAmount: result.booking.totalAmount,
    roomsSummary: result.roomsSummary,
  }).catch(() => null);

  return result;
}

export async function performAdminBookingAction(params: {
  bookingId: number;
  action: 'APPROVE' | 'REJECT' | 'CANCEL' | 'RECONCILE_PAID' | 'SAVE_NOTE' | 'FORCE_EXPIRE';
  adminUsername: string;
  reason?: string;
  bankRef?: string;
  adminNotes?: string;
}) {
  const { bookingId, action, adminUsername, reason, bankRef, adminNotes } = params;
  const settings = await getAllSiteSettings();

  const updated = await withSerializedBookingTx(async (tx) => {
    const [booking] = await tx
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId));
    if (!booking) throw new BookingError('Không tìm thấy đơn đặt phòng.', 404, 'NOT_FOUND');

    const items = await tx
      .select()
      .from(schema.bookingItems)
      .where(eq(schema.bookingItems.bookingId, bookingId));
    const roomsSummary = items.map((x) => `${x.roomNameSnapshot} x${x.quantity}`).join(', ');
    const now = new Date();

    if (action === 'SAVE_NOTE') {
      const [row] = await tx
        .update(schema.bookings)
        .set({ adminNotes: adminNotes ?? booking.adminNotes, updatedAt: now })
        .where(eq(schema.bookings.id, bookingId))
        .returning();
      return { booking: row, roomsSummary, eventToSend: null as null | 'APPROVED' | 'REJECTED' | 'PAID' };
    }

    if (action === 'FORCE_EXPIRE') {
      await tx
        .update(schema.bookings)
        .set({ holdExpiresAt: new Date(Date.now() - 60_000) })
        .where(eq(schema.bookings.id, bookingId));
      await expireStaleHolds(tx);
      const [row] = await tx
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, bookingId));
      return { booking: row, roomsSummary, eventToSend: null as null | 'APPROVED' | 'REJECTED' | 'PAID' };
    }

    if (action === 'APPROVE') {
      if (booking.status !== 'PENDING') {
        throw new BookingError(
          `Đơn đang ở trạng thái ${booking.status}, không thể duyệt.`,
          400,
          'INVALID_TRANSITION'
        );
      }
      const payExpiresAt = new Date(Date.now() + settings.policy.holdMinutesPayment * 60_000);
      const qr = await generateVietQrForBooking({
        bookingCode: booking.bookingCode,
        amount: booking.totalAmount,
        paymentSettings: settings.payment,
      });

      const [existingPay] = await tx
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.bookingId, bookingId));

      if (!existingPay) {
        await tx.insert(schema.payments).values({
          bookingId: booking.id,
          provider: 'VIETQR',
          amount: qr.amount,
          currency: 'VND',
          status: 'AWAITING_TRANSFER',
          qrImageUrl: qr.qrImageUrl,
          qrPayload: qr.qrPayload,
          bankBin: qr.bankBin,
          bankName: qr.bankName,
          accountNo: qr.accountNo,
          accountName: qr.accountName,
          transferContent: qr.transferContent,
          expiresAt: payExpiresAt,
        });
      }

      const [row] = await tx
        .update(schema.bookings)
        .set({
          status: 'AWAITING_PAYMENT',
          paymentStatus: 'AWAITING_TRANSFER',
          approvedAt: now,
          holdExpiresAt: payExpiresAt,
          adminNotes: adminNotes ?? booking.adminNotes,
          updatedAt: now,
        })
        .where(eq(schema.bookings.id, bookingId))
        .returning();

      await tx.insert(schema.bookingStatusHistory).values({
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'AWAITING_PAYMENT',
        actorType: 'ADMIN',
        actorName: adminUsername,
        note: 'Chủ homestay đã duyệt giữ phòng và mở mã VietQR thanh toán.',
      });

      return { booking: row, roomsSummary, eventToSend: 'APPROVED' as const };
    }

    if (action === 'REJECT' || action === 'CANCEL') {
      const nextStatus = action === 'REJECT' ? 'REJECTED' : 'CANCELLED';
      if (['REJECTED', 'CANCELLED', 'EXPIRED'].includes(booking.status)) {
        throw new BookingError(`Đơn đã đóng (${booking.status}).`, 400, 'INVALID_TRANSITION');
      }
      const [row] = await tx
        .update(schema.bookings)
        .set({
          status: nextStatus,
          rejectedReason: reason || booking.rejectedReason || 'Không còn phòng phù hợp',
          adminNotes: adminNotes ?? booking.adminNotes,
          updatedAt: now,
        })
        .where(eq(schema.bookings.id, bookingId))
        .returning();

      await tx
        .update(schema.payments)
        .set({ status: 'EXPIRED', updatedAt: now })
        .where(and(eq(schema.payments.bookingId, bookingId), eq(schema.payments.status, 'AWAITING_TRANSFER')));

      await tx.insert(schema.bookingStatusHistory).values({
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: nextStatus,
        actorType: 'ADMIN',
        actorName: adminUsername,
        note: reason || (action === 'REJECT' ? 'Từ chối yêu cầu đặt phòng' : 'Hủy đơn đặt phòng'),
      });

      return {
        booking: row,
        roomsSummary,
        eventToSend: action === 'REJECT' ? ('REJECTED' as const) : null,
      };
    }

    if (action === 'RECONCILE_PAID') {
      if (booking.paymentStatus === 'PAID' && booking.status === 'CONFIRMED') {
        return { booking, roomsSummary, eventToSend: null };
      }
      const cleanRef = bankRef?.trim() || `MANUAL-${booking.bookingCode}`;

      const [existingPay] = await tx
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.bookingId, bookingId));

      if (existingPay) {
        await tx
          .update(schema.payments)
          .set({
            status: 'PAID',
            provider: 'MANUAL_BANK_MATCH',
            transactionRef: cleanRef,
            paidAt: now,
            verifiedBy: `ADMIN:${adminUsername}`,
            updatedAt: now,
          })
          .where(eq(schema.payments.id, existingPay.id));
      } else {
        const qr = await generateVietQrForBooking({
          bookingCode: booking.bookingCode,
          amount: booking.totalAmount,
          paymentSettings: settings.payment,
        });
        await tx.insert(schema.payments).values({
          bookingId: booking.id,
          provider: 'MANUAL_BANK_MATCH',
          transactionRef: cleanRef,
          amount: booking.totalAmount,
          currency: 'VND',
          status: 'PAID',
          qrImageUrl: qr.qrImageUrl,
          qrPayload: qr.qrPayload,
          bankBin: qr.bankBin,
          bankName: qr.bankName,
          accountNo: qr.accountNo,
          accountName: qr.accountName,
          transferContent: qr.transferContent,
          expiresAt: now,
          paidAt: now,
          verifiedBy: `ADMIN:${adminUsername}`,
        });
      }

      const [row] = await tx
        .update(schema.bookings)
        .set({
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          confirmedAt: now,
          holdExpiresAt: null,
          adminNotes: adminNotes ?? booking.adminNotes,
          updatedAt: now,
        })
        .where(eq(schema.bookings.id, bookingId))
        .returning();

      const [cust] = await tx
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, booking.customerId));
      if (cust) {
        await tx
          .update(schema.customers)
          .set({ totalSpent: cust.totalSpent + booking.totalAmount, updatedAt: now })
          .where(eq(schema.customers.id, cust.id));
      }

      await tx.insert(schema.bookingStatusHistory).values({
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'CONFIRMED',
        actorType: 'ADMIN',
        actorName: adminUsername,
        note: `Đối soát giao dịch ngân hàng thành công (Mã tham chiếu: ${cleanRef}).`,
      });

      return { booking: row, roomsSummary, eventToSend: 'PAID' as const };
    }

    throw new BookingError('Thao tác không hỗ trợ.', 400, 'UNSUPPORTED_ACTION');
  });

  if (updated.eventToSend === 'APPROVED') {
    await dispatchZaloNotification({
      bookingId: updated.booking.id,
      bookingCode: updated.booking.bookingCode,
      eventType: 'BOOKING_APPROVED_GUEST',
      customerName: updated.booking.customerName,
      customerPhone: updated.booking.customerPhone,
      checkInDate: updated.booking.checkInDate,
      checkOutDate: updated.booking.checkOutDate,
      totalAmount: updated.booking.totalAmount,
      roomsSummary: updated.roomsSummary,
    }).catch(() => null);
  } else if (updated.eventToSend === 'REJECTED') {
    await dispatchZaloNotification({
      bookingId: updated.booking.id,
      bookingCode: updated.booking.bookingCode,
      eventType: 'BOOKING_REJECTED_GUEST',
      customerName: updated.booking.customerName,
      customerPhone: updated.booking.customerPhone,
      checkInDate: updated.booking.checkInDate,
      checkOutDate: updated.booking.checkOutDate,
      totalAmount: updated.booking.totalAmount,
      roomsSummary: updated.roomsSummary,
      note: updated.booking.rejectedReason || '',
    }).catch(() => null);
  } else if (updated.eventToSend === 'PAID') {
    await dispatchZaloNotification({
      bookingId: updated.booking.id,
      bookingCode: updated.booking.bookingCode,
      eventType: 'PAYMENT_CONFIRMED_GUEST',
      customerName: updated.booking.customerName,
      customerPhone: updated.booking.customerPhone,
      checkInDate: updated.booking.checkInDate,
      checkOutDate: updated.booking.checkOutDate,
      totalAmount: updated.booking.totalAmount,
      roomsSummary: updated.roomsSummary,
    }).catch(() => null);
  }

  return updated.booking;
}

export async function confirmGuestBookingPayment(bookingCode: string) {
  await ensureDbSchema();
  const cleanCode = bookingCode.trim().toUpperCase();
  if (!cleanCode) {
    throw new BookingError('Thiếu mã đơn đặt phòng.', 400, 'INVALID_CODE');
  }

  const settings = await getAllSiteSettings();

  const updated = await withSerializedBookingTx(async (tx) => {
    await expireStaleHolds(tx);
    const [booking] = await tx
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.bookingCode, cleanCode));

    if (!booking) {
      throw new BookingError('Không tìm thấy mã đơn đặt phòng.', 404, 'BOOKING_NOT_FOUND');
    }

    if (['REJECTED', 'CANCELLED', 'EXPIRED'].includes(booking.status)) {
      throw new BookingError(
        'Đơn đặt phòng này đã hủy hoặc hết thời hạn giữ chỗ.',
        409,
        'BOOKING_CLOSED'
      );
    }

    const items = await tx
      .select()
      .from(schema.bookingItems)
      .where(eq(schema.bookingItems.bookingId, booking.id));
    const roomsSummary = items.map((i) => `${i.roomNameSnapshot} x${i.quantity}`).join(', ');

    if (booking.paymentStatus === 'PAID' && booking.status === 'CONFIRMED') {
      return { booking, roomsSummary, alreadyPaid: true };
    }

    const now = new Date();
    const cleanRef = `VIETQR-${booking.bookingCode}`;

    const [existingPay] = await tx
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.bookingId, booking.id));

    if (existingPay) {
      await tx
        .update(schema.payments)
        .set({
          status: 'PAID',
          provider: 'VIETQR',
          transactionRef: existingPay.transactionRef || cleanRef,
          paidAt: now,
          verifiedBy: 'GUEST_CONFIRMED',
          updatedAt: now,
        })
        .where(eq(schema.payments.id, existingPay.id));
    } else {
      const qr = await generateVietQrForBooking({
        bookingCode: booking.bookingCode,
        amount: booking.totalAmount,
        paymentSettings: settings.payment,
      });
      await tx.insert(schema.payments).values({
        bookingId: booking.id,
        provider: 'VIETQR',
        transactionRef: cleanRef,
        amount: booking.totalAmount,
        currency: 'VND',
        status: 'PAID',
        qrImageUrl: qr.qrImageUrl,
        qrPayload: qr.qrPayload,
        bankBin: qr.bankBin,
        bankName: qr.bankName,
        accountNo: qr.accountNo,
        accountName: qr.accountName,
        transferContent: qr.transferContent,
        expiresAt: now,
        paidAt: now,
        verifiedBy: 'GUEST_CONFIRMED',
      });
    }

    const [row] = await tx
      .update(schema.bookings)
      .set({
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        confirmedAt: now,
        holdExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(schema.bookings.id, booking.id))
      .returning();

    const [cust] = await tx
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, booking.customerId));
    if (cust) {
      await tx
        .update(schema.customers)
        .set({ totalSpent: cust.totalSpent + booking.totalAmount, updatedAt: now })
        .where(eq(schema.customers.id, cust.id));
    }

    await tx.insert(schema.bookingStatusHistory).values({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: 'CONFIRMED',
      actorType: 'GUEST',
      actorName: booking.customerName,
      note: 'Khách hàng xác nhận đã hoàn tất thanh toán VietQR — phòng đã được giữ cố định trong CSDL.',
    });

    return { booking: row, roomsSummary, alreadyPaid: false };
  });

  if (!updated.alreadyPaid) {
    await dispatchZaloNotification({
      bookingId: updated.booking.id,
      bookingCode: updated.booking.bookingCode,
      eventType: 'PAYMENT_CONFIRMED_GUEST',
      customerName: updated.booking.customerName,
      customerPhone: updated.booking.customerPhone,
      checkInDate: updated.booking.checkInDate,
      checkOutDate: updated.booking.checkOutDate,
      totalAmount: updated.booking.totalAmount,
      roomsSummary: updated.roomsSummary,
    });
    await dispatchZaloNotification({
      bookingId: updated.booking.id,
      bookingCode: updated.booking.bookingCode,
      eventType: 'PAYMENT_CONFIRMED_OWNER',
      customerName: updated.booking.customerName,
      customerPhone: updated.booking.customerPhone,
      checkInDate: updated.booking.checkInDate,
      checkOutDate: updated.booking.checkOutDate,
      totalAmount: updated.booking.totalAmount,
      roomsSummary: updated.roomsSummary,
    });
  }

  return updated.booking;
}

export async function processPaymentWebhookEvent(params: {
  transactionRef: string;
  bookingCode: string;
  amount: number;
  transferContent?: string;
  rawPayload: Record<string, unknown>;
}) {
  const { transactionRef, bookingCode, amount, transferContent, rawPayload } = params;

  const outcome = await withSerializedBookingTx(async (tx) => {
    await expireStaleHolds(tx);

    // 1. Idempotency check by transactionRef
    const dupPay = await tx
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.transactionRef, transactionRef));

    if (dupPay.length > 0 && dupPay[0].status === 'PAID') {
      return {
        status: 'ALREADY_PROCESSED' as const,
        bookingId: dupPay[0].bookingId,
        message: 'Giao dịch đã được ghi nhận trước đó (idempotent).',
      };
    }

    const [booking] = await tx
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.bookingCode, bookingCode));

    if (!booking) {
      throw new BookingError(`Không tìm thấy mã đơn ${bookingCode}.`, 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.status === 'EXPIRED' || booking.status === 'REJECTED' || booking.status === 'CANCELLED') {
      throw new BookingError(
        `Đơn ${bookingCode} đã ở trạng thái ${booking.status}, không thể tự động xác nhận.`,
        409,
        'BOOKING_CLOSED'
      );
    }

    const [payment] = await tx
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.bookingId, booking.id));

    const now = new Date();

    // 2. Strict server-side amount verification
    if (Math.round(amount) !== booking.totalAmount) {
      if (payment) {
        await tx
          .update(schema.payments)
          .set({
            status: 'REJECTED_MISMATCH',
            rawWebhookPayload: rawPayload,
            updatedAt: now,
          })
          .where(eq(schema.payments.id, payment.id));
      }
      await tx.insert(schema.bookingStatusHistory).values({
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: booking.status,
        actorType: 'PAYMENT_WEBHOOK',
        actorName: 'Cổng đối soát ngân hàng',
        note: `Từ chối xác nhận tự động: Số tiền nhận (${amount} đ) không khớp tổng đơn (${booking.totalAmount} đ). Mã GD: ${transactionRef}.`,
      });
      return {
        status: 'AMOUNT_MISMATCH' as const,
        bookingId: booking.id,
        expected: booking.totalAmount,
        received: amount,
        message: `Số tiền chuyển khoản (${amount} đ) không khớp tổng đơn (${booking.totalAmount} đ).`,
      };
    }

    // 3. Exact match -> Confirm payment + booking
    if (payment) {
      await tx
        .update(schema.payments)
        .set({
          provider: 'BANK_WEBHOOK',
          transactionRef,
          status: 'PAID',
          paidAt: now,
          rawWebhookPayload: rawPayload,
          verifiedBy: 'BANK_WEBHOOK_HMAC',
          updatedAt: now,
        })
        .where(eq(schema.payments.id, payment.id));
    } else {
      await tx.insert(schema.payments).values({
        bookingId: booking.id,
        provider: 'BANK_WEBHOOK',
        transactionRef,
        amount: booking.totalAmount,
        currency: 'VND',
        status: 'PAID',
        qrImageUrl: '',
        qrPayload: '',
        bankBin: '970436',
        bankName: 'Webhook Bank',
        accountNo: 'WEBHOOK',
        accountName: 'SEEME HOMESTAY',
        transferContent: transferContent || `SEEME ${booking.bookingCode}`,
        expiresAt: now,
        paidAt: now,
        rawWebhookPayload: rawPayload,
        verifiedBy: 'BANK_WEBHOOK_HMAC',
      });
    }

    await tx
      .update(schema.bookings)
      .set({
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        confirmedAt: now,
        holdExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(schema.bookings.id, booking.id));

    const [cust] = await tx
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, booking.customerId));
    if (cust) {
      await tx
        .update(schema.customers)
        .set({ totalSpent: cust.totalSpent + booking.totalAmount, updatedAt: now })
        .where(eq(schema.customers.id, cust.id));
    }

    await tx.insert(schema.bookingStatusHistory).values({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: 'CONFIRMED',
      actorType: 'PAYMENT_WEBHOOK',
      actorName: 'Cổng đối soát ngân hàng',
      note: `Thanh toán VietQR đã được xác thực thành công (Mã GD: ${transactionRef}, số tiền: ${amount} đ).`,
    });

    const items = await tx
      .select()
      .from(schema.bookingItems)
      .where(eq(schema.bookingItems.bookingId, booking.id));

    return {
      status: 'CONFIRMED' as const,
      booking,
      roomsSummary: items.map((x) => `${x.roomNameSnapshot} x${x.quantity}`).join(', '),
      message: 'Xác thực thanh toán thành công.',
    };
  });

  if (outcome.status === 'CONFIRMED') {
    await dispatchZaloNotification({
      bookingId: outcome.booking.id,
      bookingCode: outcome.booking.bookingCode,
      eventType: 'PAYMENT_CONFIRMED_GUEST',
      customerName: outcome.booking.customerName,
      customerPhone: outcome.booking.customerPhone,
      checkInDate: outcome.booking.checkInDate,
      checkOutDate: outcome.booking.checkOutDate,
      totalAmount: outcome.booking.totalAmount,
      roomsSummary: outcome.roomsSummary,
    }).catch(() => null);
  }

  return outcome;
}
