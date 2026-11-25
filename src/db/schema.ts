import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export interface NightlyBreakdownItem {
  date: string;
  price: number;
  ruleName: string;
  ruleType: string;
  isHoliday: boolean;
}

export interface PolicySettingsConfig {
  fullRefundDaysBefore: number;      // e.g., 7 -> >= 7 days before check-in => 100% refund
  partialRefundDaysBefore: number;   // e.g., 3 -> >= 3 and < 7 days before => 50% refund
  partialRefundPercent: number;      // e.g., 50
  noRefundUnderDays: number;         // e.g., 3 -> < 3 days before => 0% refund
  holidayNonRefundable: boolean;     // true -> Holidays/Tet = 0% refund, no reschedule
  groupRoomThreshold: number;        // e.g., 3 rooms
  groupMinNoticeDays: number;        // e.g., 14 days (configurable 10-14 days)
  boundaryRuleNote: string;          // Explains exact >= 7 days, 3..6 days, < 3 days cutoffs
  checkInTime: string;               // e.g., "14:00"
  checkOutTime: string;              // e.g., "12:00"
  holdMinutesApproval: number;       // Hold window once approved / pending
  holdMinutesPayment: number;        // VietQR countdown deadline minutes (e.g., 30)
}

export interface CancellationPolicySnapshot {
  config: PolicySettingsConfig;
  daysUntilCheckIn: number;
  containsHoliday: boolean;
  isGroupOrWholeHouse: boolean;
  applicableTierLabel: string;
  applicableRefundPercent: number;
  summaryText: string;
}

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  subtitle: text('subtitle').notNull(),
  description: text('description').notNull(),
  standardCapacity: integer('standard_capacity').notNull(),
  maxCapacity: integer('max_capacity').notNull(),
  bedConfig: text('bed_config').notNull(),
  sizeSqm: integer('size_sqm'),
  bathroomType: text('bathroom_type').notNull(),
  viewType: text('view_type').notNull(),
  amenities: jsonb('amenities').$type<string[]>().notNull().default([]),
  highlights: jsonb('highlights').$type<string[]>().notNull().default([]),
  baseWeekdayPrice: integer('base_weekday_price').notNull(),
  baseWeekendPrice: integer('base_weekend_price').notNull(),
  totalUnits: integer('total_units').notNull().default(1),
  isPriceConfigured: boolean('is_price_configured').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const roomImages = pgTable('room_images', {
  id: serial('id').primaryKey(),
  roomId: integer('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  srcSet: text('src_set'),
  altText: text('alt_text').notNull(),
  sourceType: text('source_type').notNull().default('stand_in'), // 'client' | 'stand_in' | 'uploaded'
  creditText: text('credit_text'),
  isPrimary: boolean('is_primary').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const pricingRules = pgTable('pricing_rules', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  ruleType: text('rule_type').notNull(), // 'WEEKDAY' | 'WEEKEND' | 'SEASONAL' | 'HOLIDAY' | 'OVERRIDE'
  roomId: integer('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
  startDate: text('start_date').notNull(), // 'YYYY-MM-DD'
  endDate: text('end_date').notNull(),     // 'YYYY-MM-DD' (inclusive)
  daysOfWeek: jsonb('days_of_week').$type<number[] | null>(), // 0=Sun..6=Sat
  priceMode: text('price_mode').notNull().default('FIXED'), // 'FIXED' | 'PERCENT_MULTIPLIER' | 'AMOUNT_DELTA'
  amount: integer('amount').notNull(), // VND if FIXED/DELTA, or percent integer (e.g. 120 = 1.2x)
  priority: integer('priority').notNull().default(10),
  note: text('note'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const availabilityBlocks = pgTable(
  'availability_blocks',
  {
    id: serial('id').primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    blockDate: text('block_date').notNull(), // 'YYYY-MM-DD'
    unitsBlocked: integer('units_blocked').notNull().default(1),
    reason: text('reason').notNull().default('OWNER_BLOCK'), // 'OWNER_BLOCK' | 'MAINTENANCE' | 'OFFLINE_BOOKING'
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('avail_block_room_date_idx').on(table.roomId, table.blockDate)]
);

export const extraServices = pgTable('extra_services', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'FOOD' | 'EXPERIENCE' | 'TRANSPORT' | 'ADDON'
  description: text('description').notNull(),
  price: integer('price').notNull(),
  unit: text('unit').notNull(),
  imageUrl: text('image_url').notNull(),
  imageAlt: text('image_alt').notNull(),
  sourceType: text('source_type').notNull().default('stand_in'),
  isAvailable: boolean('is_available').notNull().default(true),
  isPriceConfigured: boolean('is_price_configured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const customers = pgTable(
  'customers',
  {
    id: serial('id').primaryKey(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    internalNotes: text('internal_notes'),
    totalBookings: integer('total_bookings').notNull().default(0),
    totalSpent: integer('total_spent').notNull().default(0),
    lastStayDate: text('last_stay_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('customers_phone_idx').on(table.phone)]
);

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  bookingCode: text('booking_code').notNull().unique(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'restrict' }),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email'),
  checkInDate: text('check_in_date').notNull(),
  checkOutDate: text('check_out_date').notNull(),
  nights: integer('nights').notNull(),
  guestsCount: integer('guests_count').notNull(),
  roomsCount: integer('rooms_count').notNull().default(1),
  isWholeHouse: boolean('is_whole_house').notNull().default(false),
  roomSubtotal: integer('room_subtotal').notNull(),
  servicesSubtotal: integer('services_subtotal').notNull(),
  totalAmount: integer('total_amount').notNull(),
  status: text('status').notNull().default('PENDING'), // 'PENDING' | 'APPROVED' | 'AWAITING_PAYMENT' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
  workflowMode: text('workflow_mode').notNull().default('INSTANT_PAYMENT'), // 'INSTANT_PAYMENT' | 'APPROVAL_FIRST'
  paymentStatus: text('payment_status').notNull().default('UNPAID'), // 'UNPAID' | 'AWAITING_TRANSFER' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED'
  expectedCheckInTime: text('expected_check_in_time'),
  roomPrepNotes: text('room_prep_notes'),
  specialNotes: text('special_notes'),
  consultationTopics: jsonb('consultation_topics').$type<string[]>().notNull().default([]),
  consultationQuestion: text('consultation_question'),
  cancellationPolicyAgreed: boolean('cancellation_policy_agreed').notNull().default(true),
  cancellationPolicySnapshot: jsonb('cancellation_policy_snapshot')
    .$type<CancellationPolicySnapshot>()
    .notNull(),
  holdExpiresAt: timestamp('hold_expires_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  rejectedReason: text('rejected_reason'),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const bookingItems = pgTable('booking_items', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  roomId: integer('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'restrict' }),
  roomNameSnapshot: text('room_name_snapshot').notNull(),
  quantity: integer('quantity').notNull().default(1),
  nightlyBreakdown: jsonb('nightly_breakdown').$type<NightlyBreakdownItem[]>().notNull(),
  subtotal: integer('subtotal').notNull(),
});

export const bookingServices = pgTable('booking_services', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  serviceId: integer('service_id').references(() => extraServices.id, { onDelete: 'set null' }),
  serviceNameSnapshot: text('service_name_snapshot').notNull(),
  unitPrice: integer('unit_price').notNull(),
  unit: text('unit').notNull(),
  quantity: integer('quantity').notNull(),
  subtotal: integer('subtotal').notNull(),
});

export const bookingStatusHistory = pgTable('booking_status_history', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  actorType: text('actor_type').notNull(), // 'GUEST' | 'ADMIN' | 'SYSTEM' | 'PAYMENT_WEBHOOK'
  actorName: text('actor_name').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('VIETQR'), // 'VIETQR' | 'BANK_WEBHOOK' | 'MANUAL_BANK_MATCH'
  transactionRef: text('transaction_ref').unique(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('VND'),
  status: text('status').notNull().default('AWAITING_TRANSFER'), // 'AWAITING_TRANSFER' | 'PAID' | 'REJECTED_MISMATCH' | 'EXPIRED'
  qrImageUrl: text('qr_image_url').notNull(),
  qrPayload: text('qr_payload').notNull(),
  bankBin: text('bank_bin').notNull(),
  bankName: text('bank_name').notNull(),
  accountNo: text('account_no').notNull(),
  accountName: text('account_name').notNull(),
  transferContent: text('transfer_content').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  rawWebhookPayload: jsonb('raw_webhook_payload'),
  verifiedBy: text('verified_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notificationLogs = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  channel: text('channel').notNull().default('ZALO_OA'), // 'ZALO_OA' | 'ZALO_ZNS'
  eventType: text('event_type').notNull(),
  recipient: text('recipient').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('UNSENT'), // 'UNSENT' | 'PENDING_CONFIG' | 'SENT' | 'FAILED'
  providerMessageId: text('provider_message_id'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  authorName: text('author_name').notNull(),
  sourceLabel: text('source_label').notNull(),
  sourceDate: text('source_date').notNull(),
  quote: text('quote').notNull(),
  isPublished: boolean('is_published').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const adminSessions = pgTable('admin_sessions', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
