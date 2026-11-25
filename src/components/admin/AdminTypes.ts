export interface AdminBookingItem {
  id: number;
  roomId: number;
  roomNameSnapshot: string;
  quantity: number;
  subtotal: number;
}

export interface AdminBookingService {
  id: number;
  serviceNameSnapshot: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  subtotal: number;
}

export interface AdminBookingRecord {
  id: number;
  bookingCode: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  guestsCount: number;
  roomsCount: number;
  isWholeHouse: boolean;
  roomSubtotal: number;
  servicesSubtotal: number;
  totalAmount: number;
  status: string;
  workflowMode: string;
  paymentStatus: string;
  expectedCheckInTime: string | null;
  roomPrepNotes: string | null;
  specialNotes: string | null;
  consultationTopics: string[];
  consultationQuestion: string | null;
  adminNotes: string | null;
  rejectedReason: string | null;
  createdAt: string;
  items?: AdminBookingItem[];
  services?: AdminBookingService[];
  payments?: AdminPaymentRecord[];
  history?: {
    id: number;
    toStatus: string;
    actorName: string;
    note: string | null;
    createdAt: string;
  }[];
}

export interface AdminPaymentRecord {
  id: number;
  bookingId: number;
  bookingCode?: string;
  customerName?: string;
  customerPhone?: string;
  provider: string;
  transactionRef: string | null;
  amount: number;
  status: string;
  bankName: string;
  accountNo: string;
  transferContent: string;
  paidAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
}

export interface AdminNotificationLog {
  id: number;
  bookingId: number | null;
  channel: string;
  eventType: string;
  recipient: string;
  payload: Record<string, unknown>;
  status: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
}

export interface AdminRoomRecord {
  id: number;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  standardCapacity: number;
  maxCapacity: number;
  bedConfig: string;
  sizeSqm: number | null;
  bathroomType: string;
  viewType: string;
  amenities: string[];
  highlights: string[];
  baseWeekdayPrice: number;
  baseWeekendPrice: number;
  totalUnits: number;
  isPriceConfigured: boolean;
  isActive: boolean;
  images: {
    id?: number;
    url: string;
    altText: string;
    sourceType: string;
    creditText?: string | null;
    isPrimary: boolean;
  }[];
}

export interface AdminPricingRule {
  id: number;
  name: string;
  ruleType: string;
  roomId: number | null;
  startDate: string;
  endDate: string;
  daysOfWeek: number[] | null;
  priceMode: string;
  amount: number;
  priority: number;
  note: string | null;
  isActive: boolean;
}

export interface AdminServiceRecord {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  unit: string;
  imageUrl: string;
  imageAlt: string;
  sourceType: string;
  isAvailable: boolean;
}

export interface AdminCustomerRecord {
  id: number;
  fullName: string;
  phone: string;
  email: string | null;
  tags: string[];
  internalNotes: string | null;
  totalBookings: number;
  totalSpent: number;
  lastStayDate: string | null;
}
