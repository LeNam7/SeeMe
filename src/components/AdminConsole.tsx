'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  CalendarRange,
  ClipboardList,
  BedDouble,
  Utensils,
  Settings,
  LogOut,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Phone,
  MessageCircle,
  ArrowRight,
  Search,
  Menu,
  X,
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { formatDateVi, formatVnd } from '@/lib/dates';
import { AdminMatrixCalendar } from './admin/AdminMatrixCalendar';
import {
  AdminRoomsTab,
  AdminServicesTab,
  AdminSettingsTab,
} from './admin/AdminOperationsTabs';
import type {
  AdminBookingRecord,
  AdminRoomRecord,
  AdminServiceRecord,
} from './admin/AdminTypes';
import type { AllSiteSettings } from '@/lib/settings';

type TabId = 'dashboard' | 'calendar' | 'bookings' | 'rooms' | 'services' | 'settings';
type BookingFilterId = 'ALL' | 'AWAITING_PAYMENT' | 'CONFIRMED' | 'CLOSED';

interface NavTabMeta {
  id: TabId;
  label: string;
  subtitle: string;
  group: 'operations' | 'homestay';
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_TABS: NavTabMeta[] = [
  {
    id: 'dashboard',
    label: 'Tổng quan',
    subtitle: 'Tình hình đón khách và trạng thái đặt phòng hôm nay',
    group: 'operations',
    icon: LayoutDashboard,
  },
  {
    id: 'calendar',
    label: 'Lịch phòng',
    subtitle: 'Ma trận phòng trống, khóa ngày thủ công và giá theo ngày',
    group: 'operations',
    icon: CalendarRange,
  },
  {
    id: 'bookings',
    label: 'Đơn đặt',
    subtitle: 'Theo dõi trạng thái thanh toán, lịch giữ phòng và ghi chú của khách',
    group: 'operations',
    icon: ClipboardList,
  },
  {
    id: 'rooms',
    label: 'Phòng & Ảnh',
    subtitle: 'Cập nhật giá niêm yết, thông tin phòng và thư viện ảnh thật',
    group: 'homestay',
    icon: BedDouble,
  },
  {
    id: 'services',
    label: 'Dịch vụ',
    subtitle: 'Quản lý bảng giá và trạng thái mở đặt lẩu, BBQ, thuê xe',
    group: 'homestay',
    icon: Utensils,
  },
  {
    id: 'settings',
    label: 'Cài đặt',
    subtitle: 'Tài khoản nhận VietQR và chính sách hoàn hủy',
    group: 'homestay',
    icon: Settings,
  },
];

const BOOKING_STATUS_META: Record<string, { label: string; badgeClass: string }> = {
  PENDING: {
    label: 'Đang thanh toán',
    badgeClass: 'bg-amber-50 text-amber-900 border border-amber-200',
  },
  APPROVED: {
    label: 'Đang thanh toán',
    badgeClass: 'bg-amber-50 text-amber-900 border border-amber-200',
  },
  AWAITING_PAYMENT: {
    label: 'Đang thanh toán',
    badgeClass: 'bg-amber-50 text-amber-900 border border-amber-200',
  },
  CONFIRMED: {
    label: 'Đã thanh toán',
    badgeClass: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
  },
  REJECTED: {
    label: 'Đã hủy',
    badgeClass: 'bg-neutral-100 text-neutral-700 border border-black/10',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass: 'bg-neutral-100 text-neutral-700 border border-black/10',
  },
  EXPIRED: {
    label: 'Hết hạn thanh toán',
    badgeClass: 'bg-neutral-100 text-neutral-700 border border-black/10',
  },
};

const PAYMENT_STATUS_META: Record<string, { label: string; textClass: string }> = {
  PAID: { label: 'Đã thanh toán', textClass: 'text-emerald-800' },
  AWAITING_TRANSFER: { label: 'Chờ chuyển khoản', textClass: 'text-[#8d3f28]' },
  UNPAID: { label: 'Chờ chuyển khoản', textClass: 'text-[#8d3f28]' },
  EXPIRED: { label: 'Hết hạn QR', textClass: 'text-neutral-600' },
  REJECTED_MISMATCH: { label: 'Lệch giao dịch', textClass: 'text-red-800' },
};

function getBookingStatusMeta(status: string) {
  return (
    BOOKING_STATUS_META[status] || {
      label: status,
      badgeClass: 'bg-neutral-100 text-neutral-700 border border-black/10',
    }
  );
}

function getPaymentStatusMeta(status: string) {
  return (
    PAYMENT_STATUS_META[status] || {
      label: status,
      textClass: 'text-[#5c5750]',
    }
  );
}

function toZaloHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://zalo.me/${digits}`;
}

export function AdminConsole({
  initialSession,
}: {
  initialSession: { username: string; sessionId: string } | null;
}) {
  const [session, setSession] = useState(initialSession);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BookingFilterId>('ALL');
  const [dashboardFilter, setDashboardFilter] = useState<'ACTION_REQUIRED' | 'RECENT'>(
    'ACTION_REQUIRED'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [kpis, setKpis] = useState({
    pendingCount: 0,
    awaitingPaymentCount: 0,
    confirmedCount: 0,
    checkInsTodayCount: 0,
    occupancyTodayPercent: 0,
    confirmedRevenue: 0,
  });
  const [bookings, setBookings] = useState<AdminBookingRecord[]>([]);
  const [rooms, setRooms] = useState<AdminRoomRecord[]>([]);
  const [services, setServices] = useState<AdminServiceRecord[]>([]);
  const [settings, setSettings] = useState<AllSiteSettings | null>(null);

  const [selectedBooking, setSelectedBooking] = useState<AdminBookingRecord | null>(null);
  const [bankRefInput, setBankRefInput] = useState('');
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    try {
      const [dRes, bRes, rRes, sRes, stRes] = await Promise.all([
        fetch('/api/admin/dashboard', { cache: 'no-store' }),
        fetch(`/api/admin/bookings?status=ALL&q=${encodeURIComponent(searchQuery)}`, {
          cache: 'no-store',
        }),
        fetch('/api/admin/rooms', { cache: 'no-store' }),
        fetch('/api/admin/services', { cache: 'no-store' }),
        fetch('/api/admin/settings', { cache: 'no-store' }),
      ]);

      if (dRes.status === 401) {
        setSession(null);
        return;
      }

      if (dRes.ok) {
        const dJson = await dRes.json();
        setKpis(dJson.kpis);
      }
      if (bRes.ok) setBookings((await bRes.json()).bookings || []);
      if (rRes.ok) setRooms((await rRes.json()).rooms || []);
      if (sRes.ok) setServices((await sRes.json()).services || []);
      if (stRes.ok) setSettings((await stRes.json()).settings || null);
    } finally {
      setRefreshing(false);
    }
  }, [session, searchQuery]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoginError(json.error || 'Đăng nhập thất bại.');
        return;
      }
      setSession({ username: json.username, sessionId: 'active' });
      setPassword('');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setSession(null);
  }

  async function handleBookingAction(
    bookingId: number,
    action: 'RECONCILE_PAID' | 'CANCEL'
  ) {
    setActionMsg(null);
    const res = await fetch(`/api/admin/bookings/${bookingId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        reason: rejectReasonInput || undefined,
        transactionRef: bankRefInput || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setActionMsg(json.error || 'Không thể cập nhật trạng thái đơn.');
      return;
    }
    const meta = getBookingStatusMeta(json.booking.status);
    setActionMsg(`Đã cập nhật đơn ${json.booking.bookingCode} → ${meta.label}.`);
    setBankRefInput('');
    setRejectReasonInput('');
    setSelectedBooking(null);
    await loadAllData();
  }

  const bookingCounts = useMemo(() => {
    let awaiting = 0;
    let confirmed = 0;
    let closed = 0;
    for (const b of bookings) {
      if (b.status === 'AWAITING_PAYMENT' || b.status === 'PENDING' || b.status === 'APPROVED') {
        awaiting += 1;
      } else if (b.status === 'CONFIRMED') {
        confirmed += 1;
      } else {
        closed += 1;
      }
    }
    return {
      ALL: bookings.length,
      AWAITING_PAYMENT: awaiting,
      CONFIRMED: confirmed,
      CLOSED: closed,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (statusFilter === 'ALL') return bookings;
    if (statusFilter === 'AWAITING_PAYMENT') {
      return bookings.filter((b) =>
        ['AWAITING_PAYMENT', 'PENDING', 'APPROVED'].includes(b.status)
      );
    }
    if (statusFilter === 'CONFIRMED') return bookings.filter((b) => b.status === 'CONFIRMED');
    return bookings.filter((b) => ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(b.status));
  }, [bookings, statusFilter]);

  const actionRequiredBookings = useMemo(
    () =>
      bookings.filter((b) =>
        ['PENDING', 'APPROVED', 'AWAITING_PAYMENT'].includes(b.status)
      ),
    [bookings]
  );

  if (!session) {
    return (
      <div className="seeme-admin min-h-screen bg-[#f6f1e7] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-black/10 rounded-2xl p-7 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <BrandMark />
            <Link href="/" className="text-xs font-medium text-[#8d3f28] hover:underline">
              ← Trang chủ
            </Link>
          </div>
          <div>
            <h1 className="font-display text-2xl text-[#221f1c]">Quản trị SEEME Homestay</h1>
            <p className="text-xs text-[#5c5750] mt-1 leading-relaxed">
              Đăng nhập để theo dõi trạng thái đặt phòng, lịch phòng trống, dịch vụ và tài khoản VietQR.
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#5c5750] mb-1.5">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="seeme-input h-[44px]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5c5750] mb-1.5">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu quản trị"
                className="seeme-input h-[44px]"
                required
              />
            </div>
            {loginError && (
              <p className="text-xs text-red-800 bg-red-50 p-3 rounded-lg border border-red-200">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={loggingIn}
              className="btn btn--primary w-full justify-center py-2.5"
            >
              {loggingIn ? 'Đang đăng nhập...' : 'Đăng nhập Quản trị'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeTabMeta = NAV_TABS.find((t) => t.id === activeTab) ?? NAV_TABS[0];
  const pendingRoomsWarning = rooms.some((r) => !r.isPriceConfigured);
  const bankUnconfigured = !settings?.payment.accountNo;
  const dashboardBookings =
    dashboardFilter === 'ACTION_REQUIRED' ? actionRequiredBookings : bookings;

  const operationTabs = NAV_TABS.filter((t) => t.group === 'operations');
  const homestayTabs = NAV_TABS.filter((t) => t.group === 'homestay');

  function renderNavButton(t: NavTabMeta) {
    const Icon = t.icon;
    const isActive = activeTab === t.id;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => {
          setActiveTab(t.id);
          setMobileNavOpen(false);
        }}
        className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[14px] transition ${
          isActive ? 'admin-nav-active font-medium' : 'admin-nav-idle'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{t.label}</span>
        {t.id === 'bookings' && kpis.awaitingPaymentCount > 0 && (
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-amber-400 text-[#221f1c] font-bold tabular-nums">
            {kpis.awaitingPaymentCount}
          </span>
        )}
      </button>
    );
  }

  const mobileBottomTabs: { id: TabId; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', shortLabel: 'Tổng quan', icon: LayoutDashboard },
    { id: 'calendar', shortLabel: 'Lịch phòng', icon: CalendarRange },
    { id: 'bookings', shortLabel: 'Đơn đặt', icon: ClipboardList },
    { id: 'rooms', shortLabel: 'Phòng', icon: BedDouble },
  ];
  const isExtraTabActive = activeTab === 'services' || activeTab === 'settings';

  return (
    <div className="seeme-admin min-h-screen bg-[#f6f1e7] text-[#221f1c] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-[#221f1c] text-[#f6f1e7] p-5 justify-between shrink-0 sticky top-0 h-screen">
        <div className="space-y-6">
          <div className="pb-4 border-b border-white/10">
            <BrandMark inverted compact />
            <p className="text-[11px] text-[#a8a096] mt-2">Quản trị vận hành · Lô Lô Chải</p>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[#9e968c] px-3.5 mb-2 font-semibold">
                Vận hành
              </p>
              <nav className="space-y-1" aria-label="Quản lý vận hành">
                {operationTabs.map(renderNavButton)}
              </nav>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[#9e968c] px-3.5 mb-2 font-semibold">
                Homestay
              </p>
              <nav className="space-y-1" aria-label="Cấu hình homestay">
                {homestayTabs.map(renderNavButton)}
              </nav>
            </div>
          </div>
        </div>

        <div className="space-y-1 pt-4 border-t border-white/10 text-xs">
          <Link
            href="/"
            className="min-h-[40px] flex items-center justify-between px-3.5 py-2 rounded-lg hover:bg-white/[0.08] text-[#d1c9be] hover:text-[#f6f1e7] transition"
          >
            <span>Xem trang khách hàng</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="admin-logout-btn w-full min-h-[40px] flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-left transition"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Đăng xuất ({session.username})</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Dark Sidebar Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/55 backdrop-blur-[1px] flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu quản trị di động"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileNavOpen(false);
          }}
        >
          <aside className="w-72 max-w-[82vw] h-full bg-[#221f1c] text-[#f6f1e7] p-5 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div className="space-y-6">
              <div className="pb-4 border-b border-white/10 flex items-start justify-between gap-2">
                <div>
                  <BrandMark inverted compact />
                  <p className="text-[11px] text-[#a8a096] mt-2">Quản trị vận hành · Lô Lô Chải</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="admin-mobile-icon-btn w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  aria-label="Đóng menu quản trị"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[#9e968c] px-3.5 mb-2 font-semibold">
                    Vận hành
                  </p>
                  <nav className="space-y-1">{operationTabs.map(renderNavButton)}</nav>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[#9e968c] px-3.5 mb-2 font-semibold">
                    Homestay
                  </p>
                  <nav className="space-y-1">{homestayTabs.map(renderNavButton)}</nav>
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-4 border-t border-white/10 text-xs">
              <Link
                href="/"
                onClick={() => setMobileNavOpen(false)}
                className="min-h-[42px] flex items-center justify-between px-3.5 py-2 rounded-lg hover:bg-white/[0.08] text-[#d1c9be] hover:text-[#f6f1e7] transition"
              >
                <span>Xem trang khách hàng</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  void handleLogout();
                }}
                className="admin-logout-btn w-full min-h-[42px] flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-left transition"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Đăng xuất ({session.username})</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 lg:pb-10">
        {/* Mobile Dark Admin App Bar */}
        <header className="lg:hidden bg-[#221f1c] text-[#f6f1e7] border-b border-white/10 px-3.5 py-3 flex items-center justify-between gap-2.5 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="admin-mobile-icon-btn w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              aria-label="Mở menu quản trị"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base font-extrabold text-[#f6f1e7] leading-tight truncate">
                {activeTabMeta.label}
              </h1>
              <p className="text-[11px] text-[#c2bab0] leading-tight truncate mt-0.5">
                SEEME Quản trị · {activeTabMeta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void loadAllData()}
              disabled={refreshing}
              className="admin-mobile-icon-btn w-9 h-9 rounded-lg flex items-center justify-center"
              aria-label="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/"
              className="admin-mobile-icon-btn w-9 h-9 rounded-lg flex items-center justify-center"
              aria-label="Xem trang khách hàng"
              title="Xem trang khách hàng"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Desktop Top Bar */}
        <header className="hidden lg:flex bg-white/95 backdrop-blur-sm border-b border-black/10 px-8 py-3.5 items-center justify-between gap-3 sticky top-0 z-30">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold text-[#221f1c] leading-tight">
              {activeTabMeta.label}
            </h1>
            <p className="text-xs text-[#5c5750] mt-0.5 truncate">{activeTabMeta.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={() => void loadAllData()}
            disabled={refreshing}
            className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-black/15 bg-white text-xs font-semibold text-[#221f1c] hover:bg-[#faf7f1] transition shrink-0"
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl w-full mx-auto">
          {actionMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
              <span>{actionMsg}</span>
              <button
                type="button"
                onClick={() => setActionMsg(null)}
                className="text-emerald-900 hover:underline shrink-0"
              >
                Ẩn
              </button>
            </div>
          )}

          {(pendingRoomsWarning || bankUnconfigured) && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300/80 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <strong className="block text-[13px]">Lưu ý thiết lập trước khi đón khách thật</strong>
                {pendingRoomsWarning && (
                  <div>
                    • Một số hạng phòng vẫn dùng giá tham khảo — cần rà lại giá và ảnh thật.
                  </div>
                )}
                {bankUnconfigured && (
                  <div>
                    • Chưa điền số tài khoản ngân hàng nhận VietQR hiển thị cho khách khi thanh toán.
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {pendingRoomsWarning && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('rooms')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-semibold text-amber-950 hover:bg-amber-100"
                  >
                    Cập nhật Phòng & Ảnh
                  </button>
                )}
                {bankUnconfigured && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-semibold text-amber-950 hover:bg-amber-100"
                  >
                    Điền STK VietQR
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* 4 KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('AWAITING_PAYMENT');
                    setActiveTab('bookings');
                  }}
                  className="bg-white rounded-xl border border-black/10 p-4 sm:p-5 text-left hover:border-[#8d3f28]/45 transition"
                >
                  <span className="text-xs font-medium text-[#5c5750]">Đang thanh toán</span>
                  <strong className="block font-display text-3xl text-amber-700 mt-1.5 tabular-nums">
                    {kpis.awaitingPaymentCount}
                  </strong>
                  <span className="text-[11px] text-[#5c5750] mt-1 block">
                    Tạm giữ phòng chờ chuyển khoản
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('CONFIRMED');
                    setActiveTab('bookings');
                  }}
                  className="bg-white rounded-xl border border-black/10 p-4 sm:p-5 text-left hover:border-[#8d3f28]/45 transition"
                >
                  <span className="text-xs font-medium text-[#5c5750]">Đã hoàn tất</span>
                  <strong className="block font-display text-3xl text-emerald-800 mt-1.5 tabular-nums">
                    {kpis.confirmedCount}
                  </strong>
                  <span className="text-[11px] text-[#5c5750] mt-1 block">
                    Đã lưu giữ phòng trong CSDL
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="bg-white rounded-xl border border-black/10 p-4 sm:p-5 text-left hover:border-[#8d3f28]/45 transition"
                >
                  <span className="text-xs font-medium text-[#5c5750]">Lấp đầy hôm nay</span>
                  <strong className="block font-display text-3xl text-[#221f1c] mt-1.5 tabular-nums">
                    {kpis.occupancyTodayPercent}%
                  </strong>
                  <span className="text-[11px] text-[#5c5750] mt-1 block">
                    {kpis.checkInsTodayCount} khách nhận phòng hôm nay
                  </span>
                </button>

                <div className="bg-white rounded-xl border border-black/10 p-4 sm:p-5">
                  <span className="text-xs font-medium text-[#5c5750]">Doanh thu đã hoàn tất</span>
                  <strong className="block font-display text-lg sm:text-2xl text-[#8d3f28] mt-1.5 tabular-nums leading-snug">
                    {formatVnd(kpis.confirmedRevenue)}
                  </strong>
                  <span className="text-[11px] text-[#5c5750] mt-1 block">
                    Tổng từ {kpis.confirmedCount} đơn đã thanh toán
                  </span>
                </div>
              </div>

              {/* 2-Column Operational Workspace (flex avoids system.css .grid 12-col override collisions) */}
              <div className="flex flex-col lg:flex-row gap-5 items-start">
                <div className="flex-1 min-w-0 w-full bg-white rounded-xl border border-black/10 overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-black/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-xl text-[#221f1c]">Đơn đặt phòng</h2>
                      <div className="inline-flex rounded-lg bg-[#faf7f1] border border-black/10 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setDashboardFilter('ACTION_REQUIRED')}
                          className={`px-2.5 py-1 rounded-md font-medium transition ${
                            dashboardFilter === 'ACTION_REQUIRED'
                              ? 'bg-[#221f1c] text-[#f6f1e7]'
                              : 'text-[#5c5750] hover:text-[#221f1c]'
                          }`}
                        >
                          Đang thanh toán ({actionRequiredBookings.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDashboardFilter('RECENT')}
                          className={`px-2.5 py-1 rounded-md font-medium transition ${
                            dashboardFilter === 'RECENT'
                              ? 'bg-[#221f1c] text-[#f6f1e7]'
                              : 'text-[#5c5750] hover:text-[#221f1c]'
                          }`}
                        >
                          Tất cả ({bookings.length})
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('ALL');
                        setActiveTab('bookings');
                      }}
                      className="text-xs font-semibold text-[#8d3f28] hover:underline inline-flex items-center gap-1"
                    >
                      Quản lý toàn bộ <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {dashboardBookings.length === 0 ? (
                    <div className="p-8 text-center text-sm text-[#5c5750]">
                      {dashboardFilter === 'ACTION_REQUIRED'
                        ? 'Hiện không có đơn nào đang trong quá trình thanh toán.'
                        : 'Chưa có đơn đặt phòng nào.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-black/10">
                      {dashboardBookings.slice(0, 6).map((b) => {
                        const sMeta = getBookingStatusMeta(b.status);
                        const pMeta = getPaymentStatusMeta(b.paymentStatus);
                        return (
                          <div
                            key={b.id}
                            className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#faf7f1]/70 transition"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <strong className="text-sm text-[#221f1c] tabular-nums">
                                  {b.bookingCode}
                                </strong>
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${sMeta.badgeClass}`}
                                >
                                  {sMeta.label}
                                </span>
                                <span className={`text-[11px] font-medium ${pMeta.textClass}`}>
                                  · {pMeta.label}
                                </span>
                              </div>
                              <div className="text-xs text-[#221f1c]">
                                <strong>{b.customerName}</strong> ({b.customerPhone}) ·{' '}
                                <span className="text-[#5c5750]">
                                  {formatDateVi(b.checkInDate)} → {formatDateVi(b.checkOutDate)} (
                                  {b.nights} đêm)
                                </span>
                              </div>
                              <p className="text-xs text-[#5c5750] truncate">
                                {b.items?.map((i) => `${i.roomNameSnapshot} ×${i.quantity}`).join(', ')}
                              </p>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              <strong className="font-display text-base text-[#8d3f28] tabular-nums">
                                {formatVnd(b.totalAmount)}
                              </strong>
                              <button
                                type="button"
                                onClick={() => setSelectedBooking(b)}
                                className="btn btn--secondary text-xs py-2 px-3.5"
                              >
                                Xem đơn
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right Operational Quick Panel */}
                <div className="w-full lg:w-80 shrink-0 space-y-4">
                  <div className="bg-white rounded-xl border border-black/10 p-5 space-y-3.5">
                    <h2 className="font-display text-lg text-[#221f1c]">Thông tin vận hành</h2>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between py-2 border-b border-black/10">
                        <span className="text-[#5c5750]">Nhận phòng hôm nay</span>
                        <strong className="text-[#221f1c] tabular-nums">
                          {kpis.checkInsTodayCount} đơn
                        </strong>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-black/10">
                        <span className="text-[#5c5750]">Cơ chế giữ phòng</span>
                        <strong className="text-[#221f1c]">Tự động (Đang TT → Hoàn tất)</strong>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#5c5750]">Tài khoản VietQR</span>
                        <strong className="text-[#221f1c] text-right truncate max-w-[160px]">
                          {settings?.payment.accountNo
                            ? `${settings.payment.bankName} · ${settings.payment.accountNo}`
                            : 'Chưa cấu hình'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-black/10 p-5 space-y-2.5">
                    <h2 className="font-display text-lg text-[#221f1c] mb-1">Thao tác nhanh</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('calendar')}
                      className="w-full min-h-[42px] px-3.5 py-2.5 rounded-lg bg-[#faf7f1] border border-black/10 hover:border-[#8d3f28]/45 flex items-center justify-between text-xs font-semibold text-[#221f1c] transition"
                    >
                      <span>Mở lịch phòng & khóa ngày</span>
                      <ArrowRight className="w-4 h-4 text-[#8d3f28]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('rooms')}
                      className="w-full min-h-[42px] px-3.5 py-2.5 rounded-lg bg-[#faf7f1] border border-black/10 hover:border-[#8d3f28]/45 flex items-center justify-between text-xs font-semibold text-[#221f1c] transition"
                    >
                      <span>Chỉnh giá & ảnh phòng</span>
                      <ArrowRight className="w-4 h-4 text-[#8d3f28]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('services')}
                      className="w-full min-h-[42px] px-3.5 py-2.5 rounded-lg bg-[#faf7f1] border border-black/10 hover:border-[#8d3f28]/45 flex items-center justify-between text-xs font-semibold text-[#221f1c] transition"
                    >
                      <span>Cập nhật dịch vụ (Lẩu / BBQ / Xe)</span>
                      <ArrowRight className="w-4 h-4 text-[#8d3f28]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATRIX CALENDAR */}
          {activeTab === 'calendar' && (
            <AdminMatrixCalendar
              onSelectBookingCode={(code) => {
                const match = bookings.find((b) => b.bookingCode === code);
                if (match) setSelectedBooking(match);
                else {
                  setSearchQuery(code);
                  setActiveTab('bookings');
                }
              }}
            />
          )}

          {/* TAB 3: BOOKINGS LIST */}
          {activeTab === 'bookings' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-black/10 p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-[#5c5750] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm theo mã đơn, tên khách, SĐT..."
                      className="seeme-input !pl-9 h-[42px] text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'ALL', label: 'Tất cả' },
                        { id: 'AWAITING_PAYMENT', label: 'Đang thanh toán' },
                        { id: 'CONFIRMED', label: 'Đã hoàn tất' },
                        { id: 'CLOSED', label: 'Đã hủy / Hết hạn' },
                      ] as const
                    ).map((f) => {
                      const active = statusFilter === f.id;
                      const count = bookingCounts[f.id];
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setStatusFilter(f.id)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                            active
                              ? 'bg-[#221f1c] text-[#f6f1e7] border-[#221f1c]'
                              : 'bg-[#faf7f1] text-[#221f1c] border-black/10 hover:bg-[#ebe3d5]'
                          }`}
                        >
                          {f.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {filteredBookings.length === 0 ? (
                <div className="bg-white rounded-xl border border-black/10 p-10 text-center text-sm text-[#5c5750]">
                  Không có đơn nào khớp với bộ lọc hiện tại.
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block bg-white rounded-xl border border-black/10 overflow-hidden">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#faf7f1] border-b border-black/10 text-[11px] uppercase tracking-wider text-[#5c5750]">
                          <th className="py-3 px-4 font-semibold">Mã đơn</th>
                          <th className="py-3 px-4 font-semibold">Khách hàng</th>
                          <th className="py-3 px-4 font-semibold">Lịch ở & Phòng</th>
                          <th className="py-3 px-4 font-semibold">Trạng thái</th>
                          <th className="py-3 px-4 font-semibold text-right">Tổng tiền</th>
                          <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/10">
                        {filteredBookings.map((b) => {
                          const sMeta = getBookingStatusMeta(b.status);
                          const pMeta = getPaymentStatusMeta(b.paymentStatus);
                          return (
                            <tr key={b.id} className="hover:bg-[#faf7f1]/70 transition">
                              <td className="py-3.5 px-4 align-top whitespace-nowrap">
                                <strong className="text-[#221f1c] tabular-nums block">
                                  {b.bookingCode}
                                </strong>
                                <span className="text-[11px] text-[#5c5750]">
                                  {b.guestsCount} khách · {b.nights} đêm
                                </span>
                              </td>
                              <td className="py-3.5 px-4 align-top">
                                <strong className="text-[#221f1c] block">{b.customerName}</strong>
                                <span className="text-xs text-[#5c5750] tabular-nums">
                                  {b.customerPhone}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 align-top text-xs">
                                <div className="font-medium text-[#221f1c] whitespace-nowrap">
                                  {formatDateVi(b.checkInDate)} → {formatDateVi(b.checkOutDate)}
                                </div>
                                <div className="text-[#5c5750] mt-0.5">
                                  {b.items
                                    ?.map((i) => `${i.roomNameSnapshot} ×${i.quantity}`)
                                    .join(', ')}
                                </div>
                                {b.consultationTopics.length > 0 && (
                                  <div className="text-[#8d3f28] mt-0.5">
                                    Tư vấn: {b.consultationTopics.join(', ')}
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 align-top whitespace-nowrap">
                                <span
                                  className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded whitespace-nowrap ${sMeta.badgeClass}`}
                                >
                                  {sMeta.label}
                                </span>
                                <span className={`block text-[11px] mt-1 font-medium ${pMeta.textClass}`}>
                                  {pMeta.label}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                                <strong className="font-display text-base text-[#8d3f28] tabular-nums whitespace-nowrap">
                                  {formatVnd(b.totalAmount)}
                                </strong>
                              </td>
                              <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedBooking(b)}
                                  className="btn btn--primary text-xs py-2 px-3.5 whitespace-nowrap"
                                >
                                  Xem chi tiết
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List */}
                  <div className="md:hidden space-y-3">
                    {filteredBookings.map((b) => {
                      const sMeta = getBookingStatusMeta(b.status);
                      const pMeta = getPaymentStatusMeta(b.paymentStatus);
                      return (
                        <div
                          key={b.id}
                          className="bg-white rounded-xl border border-black/10 p-4 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <strong className="text-sm text-[#221f1c] tabular-nums">
                                {b.bookingCode}
                              </strong>
                              <p className="text-xs text-[#5c5750] mt-0.5">
                                {b.customerName} · {b.customerPhone}
                              </p>
                            </div>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded shrink-0 ${sMeta.badgeClass}`}
                            >
                              {sMeta.label}
                            </span>
                          </div>
                          <div className="text-xs text-[#3c342e]">
                            {formatDateVi(b.checkInDate)} → {formatDateVi(b.checkOutDate)} (
                            {b.nights} đêm · {b.guestsCount} khách)
                          </div>
                          <div className="text-xs text-[#5c5750]">
                            {b.items?.map((i) => `${i.roomNameSnapshot} ×${i.quantity}`).join(', ')}
                          </div>
                          <div className="pt-2 border-t border-black/10 flex items-center justify-between">
                            <div>
                              <strong className="font-display text-base text-[#8d3f28] tabular-nums">
                                {formatVnd(b.totalAmount)}
                              </strong>
                              <span className={`block text-[11px] ${pMeta.textClass}`}>
                                {pMeta.label}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedBooking(b)}
                              className="btn btn--primary text-xs py-2 px-3.5"
                            >
                              Xem chi tiết
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'rooms' && <AdminRoomsTab rooms={rooms} onReload={loadAllData} />}
          {activeTab === 'services' && (
            <AdminServicesTab services={services} onReload={loadAllData} />
          )}
          {activeTab === 'settings' && settings && (
            <AdminSettingsTab settings={settings} onReload={loadAllData} />
          )}
        </main>
      </div>

      {/* Native-Style Sticky Bottom Navigation Bar on Mobile */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#221f1c] border-t border-white/10 px-1.5 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]"
        aria-label="Thanh điều hướng quản trị di động"
      >
        <div className="flex items-stretch gap-1 max-w-lg mx-auto">
          {mobileBottomTabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`relative flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10.5px] font-semibold transition ${
                  isActive ? 'admin-bottom-active' : 'admin-bottom-idle'
                }`}
              >
                <Icon className="w-[18px] h-[18px] mb-0.5 shrink-0" />
                <span className="truncate max-w-full">{t.shortLabel}</span>
                {t.id === 'bookings' && kpis.awaitingPaymentCount > 0 && (
                  <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-[#221f1c] text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {kpis.awaitingPaymentCount}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10.5px] font-semibold transition ${
              isExtraTabActive || mobileNavOpen ? 'admin-bottom-active' : 'admin-bottom-idle'
            }`}
          >
            <Menu className="w-[18px] h-[18px] mb-0.5 shrink-0" />
            <span>Thêm</span>
          </button>
        </div>
      </nav>

      {/* Booking Detail & Action Modal */}
      {selectedBooking && (
        <div
          className="fixed inset-0 !mt-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl border border-black/10 p-6 sm:p-8 space-y-5 max-h-[92vh] overflow-y-auto text-sm shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded ${
                      getBookingStatusMeta(selectedBooking.status).badgeClass
                    }`}
                  >
                    {getBookingStatusMeta(selectedBooking.status).label}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      getPaymentStatusMeta(selectedBooking.paymentStatus).textClass
                    }`}
                  >
                    · {getPaymentStatusMeta(selectedBooking.paymentStatus).label}
                  </span>
                </div>
                <h3 className="font-display text-2xl text-[#221f1c] tabular-nums">
                  Đơn {selectedBooking.bookingCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="w-10 h-10 rounded-lg border border-black/10 flex items-center justify-center hover:bg-[#faf7f1]"
                aria-label="Đóng chi tiết đơn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guest + Direct Contact Shortcuts */}
            <div className="p-4 rounded-xl bg-[#faf7f1] border border-black/10 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong className="text-sm text-[#221f1c] block">
                    {selectedBooking.customerName}
                  </strong>
                  <span className="text-[#5c5750] tabular-nums">
                    SĐT: {selectedBooking.customerPhone}
                    {selectedBooking.customerEmail ? ` · ${selectedBooking.customerEmail}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={toZaloHref(selectedBooking.customerPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-black/15 font-semibold text-[#221f1c] hover:border-[#8d3f28]"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#8d3f28]" />
                    Nhắn Zalo
                  </a>
                  <a
                    href={`tel:${selectedBooking.customerPhone.replace(/\D/g, '')}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-black/15 font-semibold text-[#221f1c] hover:border-[#8d3f28]"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#8d3f28]" />
                    Gọi
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-black/10 space-y-1 text-[#3c342e]">
                <div>
                  Lưu trú: <strong>{formatDateVi(selectedBooking.checkInDate)}</strong> →{' '}
                  <strong>{formatDateVi(selectedBooking.checkOutDate)}</strong> (
                  {selectedBooking.nights} đêm · {selectedBooking.guestsCount} khách)
                </div>
                <div>
                  Phòng:{' '}
                  {selectedBooking.items
                    ?.map((i) => `${i.roomNameSnapshot} × ${i.quantity} (${formatVnd(i.subtotal)})`)
                    .join(', ')}
                </div>
                {selectedBooking.services && selectedBooking.services.length > 0 && (
                  <div>
                    Dịch vụ:{' '}
                    {selectedBooking.services
                      .map((s) => `${s.serviceNameSnapshot} × ${s.quantity}`)
                      .join(', ')}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-black/10 text-sm">
                  <span className="text-[#5c5750]">Tổng tiền đơn hàng</span>
                  <strong className="font-display text-lg text-[#8d3f28] tabular-nums">
                    {formatVnd(selectedBooking.totalAmount)}
                  </strong>
                </div>
              </div>
            </div>

            {selectedBooking.payments && selectedBooking.payments.length > 0 && (
              <div className="p-3.5 rounded-xl border border-black/10 bg-white text-xs space-y-1">
                <strong className="block text-[#221f1c]">Thông tin VietQR / Chuyển khoản</strong>
                <div className="text-[#5c5750]">
                  Nội dung CK: <strong className="text-[#221f1c]">{selectedBooking.payments[0].transferContent}</strong>
                </div>
                {selectedBooking.payments[0].transactionRef && (
                  <div className="text-emerald-800">
                    Mã giao dịch: <strong>{selectedBooking.payments[0].transactionRef}</strong>
                  </div>
                )}
              </div>
            )}

            {(selectedBooking.expectedCheckInTime ||
              selectedBooking.roomPrepNotes ||
              selectedBooking.specialNotes ||
              selectedBooking.consultationTopics.length > 0 ||
              selectedBooking.consultationQuestion) && (
              <div className="p-3.5 rounded-xl border border-black/10 text-xs space-y-1">
                <strong className="block text-[#221f1c]">Ghi chú & Yêu cầu tư vấn</strong>
                {selectedBooking.expectedCheckInTime && (
                  <p>Giờ check-in dự kiến: {selectedBooking.expectedCheckInTime}</p>
                )}
                {selectedBooking.roomPrepNotes && (
                  <p>Chuẩn bị phòng: {selectedBooking.roomPrepNotes}</p>
                )}
                {selectedBooking.specialNotes && (
                  <p>Ghi chú khác: {selectedBooking.specialNotes}</p>
                )}
                {selectedBooking.consultationTopics.length > 0 && (
                  <p>Nhu cầu: {selectedBooking.consultationTopics.join(', ')}</p>
                )}
                {selectedBooking.consultationQuestion && (
                  <p>Câu hỏi: {selectedBooking.consultationQuestion}</p>
                )}
              </div>
            )}

            {/* 2-Step Payment Status Flow */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div
                className={`p-2.5 rounded-lg border text-center font-medium ${
                  ['AWAITING_PAYMENT', 'PENDING', 'APPROVED'].includes(selectedBooking.status)
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-[#faf7f1] border-black/10 text-[#5c5750]'
                }`}
              >
                1. Đang thanh toán
              </div>
              <div
                className={`p-2.5 rounded-lg border text-center font-medium ${
                  selectedBooking.status === 'CONFIRMED'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-[#faf7f1] border-black/10 text-[#5c5750]'
                }`}
              >
                2. Đã hoàn tất (Giữ phòng)
              </div>
            </div>

            {/* Admin Actions */}
            <div className="space-y-3 pt-2 border-t border-black/10">
              {['AWAITING_PAYMENT', 'APPROVED', 'PENDING'].includes(selectedBooking.status) && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
                  <label className="block text-xs font-semibold text-emerald-950">
                    Chuyển sang Đã hoàn tất (lưu giữ phòng cố định từ{' '}
                    {formatDateVi(selectedBooking.checkInDate)} →{' '}
                    {formatDateVi(selectedBooking.checkOutDate)})
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={bankRefInput}
                      onChange={(e) => setBankRefInput(e.target.value)}
                      placeholder="Mã giao dịch ngân hàng (không bắt buộc)"
                      className="seeme-input h-[40px] text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void handleBookingAction(selectedBooking.id, 'RECONCILE_PAID')}
                      className="btn btn--primary text-xs shrink-0 py-2 px-3.5 inline-flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Đánh dấu Đã hoàn tất
                    </button>
                  </div>
                </div>
              )}

              {!['REJECTED', 'CANCELLED', 'EXPIRED'].includes(selectedBooking.status) && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-2">
                  <input
                    type="text"
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder="Lý do hủy đơn (phòng sẽ mở lại ngay)..."
                    className="seeme-input h-[40px] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void handleBookingAction(selectedBooking.id, 'CANCEL')}
                    className="btn btn--secondary w-full justify-center text-red-800 flex items-center gap-1.5 text-xs"
                  >
                    <XCircle className="w-4 h-4" />
                    Hủy đơn & Mở lại phòng
                  </button>
                </div>
              )}

              <Link
                href={`/booking/${selectedBooking.bookingCode}`}
                target="_blank"
                className="block text-center text-xs font-medium text-[#8d3f28] underline pt-1"
              >
                Mở trang thanh toán / theo dõi của khách (/booking/{selectedBooking.bookingCode}) →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
