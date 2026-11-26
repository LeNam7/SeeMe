'use client';

import React, { useEffect, useState } from 'react';
import {
  Upload,
  Plus,
  Check,
  Save,
  Pencil,
  X,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { formatVnd } from '@/lib/dates';
import type { AdminRoomRecord, AdminServiceRecord } from './AdminTypes';
import type { AllSiteSettings } from '@/lib/settings';

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  FOOD: 'Ẩm thực / Lẩu / BBQ',
  EXPERIENCE: 'Trải nghiệm / Bếp lửa',
  TRANSPORT: 'Xe máy / Đưa đón',
  ADDON: 'Tiện ích thêm',
};

function toSlugPreview(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

interface RoomFormDraft {
  id: number | null; // null = create mode
  slug: string;
  slugTouched: boolean;
  name: string;
  subtitle: string;
  description: string;
  standardCapacity: number;
  maxCapacity: number;
  bedConfig: string;
  sizeSqm: number | null;
  bathroomType: string;
  viewType: string;
  amenitiesText: string;
  highlightsText: string;
  baseWeekdayPrice: number;
  baseWeekendPrice: number;
  totalUnits: number;
  isPriceConfigured: boolean;
  isActive: boolean;
  images: AdminRoomRecord['images'];
}

function createEmptyRoomDraft(): RoomFormDraft {
  return {
    id: null,
    slug: '',
    slugTouched: false,
    name: '',
    subtitle: '',
    description: '',
    standardCapacity: 2,
    maxCapacity: 2,
    bedConfig: 'Một giường đôi Queen Size (1,8m x 2m)',
    sizeSqm: 24,
    bathroomType: 'WC khép kín',
    viewType: 'Hướng bản Lô Lô Chải & núi đá',
    amenitiesText: 'Điều hòa 2 chiều, Đèn ngủ, Máy sấy tóc, Đệm lò xo 25cm, Đèn sưởi nhà tắm, Bàn trà',
    highlightsText: 'WC khép kín riêng tư\nTường trình đất giữ ấm tự nhiên',
    baseWeekdayPrice: 950_000,
    baseWeekendPrice: 1_150_000,
    totalUnits: 1,
    isPriceConfigured: true,
    isActive: true,
    images: [],
  };
}

function roomToDraft(r: AdminRoomRecord): RoomFormDraft {
  return {
    id: r.id,
    slug: r.slug,
    slugTouched: true,
    name: r.name,
    subtitle: r.subtitle,
    description: r.description,
    standardCapacity: r.standardCapacity,
    maxCapacity: r.maxCapacity,
    bedConfig: r.bedConfig,
    sizeSqm: r.sizeSqm,
    bathroomType: r.bathroomType,
    viewType: r.viewType,
    amenitiesText: (r.amenities || []).join(', '),
    highlightsText: (r.highlights || []).join('\n'),
    baseWeekdayPrice: r.baseWeekdayPrice,
    baseWeekendPrice: r.baseWeekendPrice,
    totalUnits: r.totalUnits,
    isPriceConfigured: r.isPriceConfigured,
    isActive: r.isActive,
    images: structuredClone(r.images || []),
  };
}

export function AdminRoomsTab({
  rooms,
  onReload,
}: {
  rooms: AdminRoomRecord[];
  onReload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<RoomFormDraft | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<AdminRoomRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyRoomId, setBusyRoomId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft && !deletingRoom) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDraft(null);
        setDeletingRoom(null);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [draft, deletingRoom]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !draft) return;
    setUploading(true);
    setModalError(null);
    try {
      const uploadedImages: AdminRoomRecord['images'] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || !data.url) {
          setModalError(data.error || 'Tải ảnh thất bại. Vui lòng thử lại.');
          break;
        }
        uploadedImages.push({
          url: data.url,
          altText: `Ảnh thực tế ${draft.name || 'phòng SEEME'}`,
          sourceType: 'uploaded',
          isPrimary: draft.images.length === 0 && uploadedImages.length === 0,
        });
      }
      if (uploadedImages.length > 0) {
        setDraft((prev) =>
          prev
            ? {
                ...prev,
                images: [...prev.images, ...uploadedImages],
              }
            : prev
        );
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function saveRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setModalError(null);
    setMsg(null);
    setErrorMsg(null);

    const amenities = draft.amenitiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const highlights = draft.highlightsText
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      slug: draft.slug.trim() || toSlugPreview(draft.name),
      name: draft.name.trim(),
      subtitle: draft.subtitle.trim(),
      description: draft.description.trim(),
      standardCapacity: Number(draft.standardCapacity) || 2,
      maxCapacity: Math.max(Number(draft.standardCapacity) || 2, Number(draft.maxCapacity) || 2),
      bedConfig: draft.bedConfig.trim(),
      sizeSqm: draft.sizeSqm ? Number(draft.sizeSqm) : null,
      bathroomType: draft.bathroomType.trim() || 'WC khép kín',
      viewType: draft.viewType.trim() || 'Hướng bản Lô Lô Chải',
      amenities,
      highlights,
      baseWeekdayPrice: Number(draft.baseWeekdayPrice),
      baseWeekendPrice: Number(draft.baseWeekendPrice),
      totalUnits: Math.max(1, Number(draft.totalUnits) || 1),
      isPriceConfigured: true,
      isActive: draft.isActive,
      images: draft.images,
    };

    try {
      const isCreate = draft.id === null;
      const url = isCreate ? '/api/admin/rooms' : `/api/admin/rooms/${draft.id}`;
      const method = isCreate ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Không thể lưu thông tin phòng.');
        return;
      }
      setMsg(
        isCreate
          ? `Đã thêm hạng phòng mới "${data.room?.name || payload.name}" vào hệ thống.`
          : `Đã lưu thay đổi cho ${payload.name}.`
      );
      setDraft(null);
      await onReload();
    } catch {
      setModalError('Lỗi kết nối máy chủ khi lưu phòng.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleRoomActive(room: AdminRoomRecord) {
    setBusyRoomId(room.id);
    setMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !room.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Không thể cập nhật trạng thái hiển thị.');
        return;
      }
      setMsg(
        !room.isActive
          ? `Đã mở bán lại ${room.name} trên trang khách.`
          : `Đã chuyển ${room.name} sang trạng thái Tạm ẩn.`
      );
      await onReload();
    } finally {
      setBusyRoomId(null);
    }
  }

  async function confirmDeleteRoom(archiveFallback = false) {
    if (!deletingRoom) return;
    setBusyRoomId(deletingRoom.id);
    setMsg(null);
    setErrorMsg(null);
    try {
      const qs = archiveFallback ? '?archive=1' : '';
      const res = await fetch(`/api/admin/rooms/${deletingRoom.id}${qs}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Không thể xóa phòng này.');
        setDeletingRoom(null);
        return;
      }
      setMsg(data.message || `Đã xóa ${deletingRoom.name}.`);
      setDeletingRoom(null);
      await onReload();
    } catch {
      setErrorMsg('Lỗi kết nối khi xóa phòng.');
      setDeletingRoom(null);
    } finally {
      setBusyRoomId(null);
    }
  }

  const activeCount = rooms.filter((r) => r.isActive).length;
  const hiddenCount = rooms.length - activeCount;

  return (
    <div className="space-y-5">
      {/* Top Toolbar: Summary + Add New Room Button */}
      <div className="bg-white rounded-xl border border-black/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-[#221f1c]">
            Danh sách hạng phòng ({rooms.length})
          </h2>
          <p className="text-xs text-[#5c5750] mt-0.5">
            {activeCount} đang mở bán trên trang khách
            {hiddenCount > 0 ? ` · ${hiddenCount} đang tạm ẩn` : ''} · Đồng bộ trực tiếp với CSDL &
            Lịch phòng.
          </p>
        </div>
        <button
          type="button"
          data-add-room-btn
          onClick={() => {
            setModalError(null);
            setDraft(createEmptyRoomDraft());
          }}
          className="btn btn--primary text-xs sm:text-sm py-2.5 px-4 inline-flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Thêm phòng mới
        </button>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-black/20 p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-[#221f1c]">Chưa có hạng phòng nào trong hệ thống.</p>
          <p className="text-xs text-[#5c5750]">
            Bấm “Thêm phòng mới” để tạo hạng phòng, cấu hình giá và tải ảnh thực tế lên trang khách.
          </p>
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setDraft(createEmptyRoomDraft());
            }}
            className="btn btn--primary text-xs py-2.5 px-4 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Thêm phòng đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rooms.map((r) => {
            const thumb = r.images.find((im) => im.isPrimary) ?? r.images[0];
            const isEditing = draft?.id === r.id;
            const isBusy = busyRoomId === r.id;
            return (
              <div
                key={r.id}
                data-admin-room-card={r.slug}
                className={`bg-white rounded-xl border p-4 sm:p-5 transition ${
                  isEditing
                    ? 'border-[#8d3f28] ring-2 ring-[#8d3f28]/15'
                    : !r.isActive
                      ? 'border-black/10 opacity-75 bg-[#faf7f1]/70'
                      : 'border-black/10'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#ebe3d5] border border-black/10 shrink-0">
                    {thumb ? (
                      <img
                        src={thumb.url}
                        alt={thumb.altText}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[11px] text-[#5c5750] text-center px-1">
                        Chưa có ảnh
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-display text-lg font-extrabold text-[#221f1c] leading-snug">
                            {r.name}
                          </h3>
                          {!r.isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-200 text-neutral-700">
                              Tạm ẩn
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#5c5750] mt-0.5 line-clamp-2">{r.subtitle}</p>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                          r.isPriceConfigured
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {r.isPriceConfigured ? 'Giá chính thức' : 'Giá mặc định'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-xs text-[#3c342e] tabular-nums">
                      <span>
                        Ngày thường:{' '}
                        <strong className="text-[#221f1c]">{formatVnd(r.baseWeekdayPrice)}</strong>
                      </span>
                      <span>
                        Cuối tuần:{' '}
                        <strong className="text-[#8d3f28]">{formatVnd(r.baseWeekendPrice)}</strong>
                      </span>
                      <span className="text-[#5c5750]">
                        {r.standardCapacity === r.maxCapacity
                          ? `Tiêu chuẩn ${r.standardCapacity} khách`
                          : `Tiêu chuẩn ${r.standardCapacity}–${r.maxCapacity} khách`}
                        {r.totalUnits > 1 ? ` · ${r.totalUnits} căn` : ''}
                      </span>
                      <span className="text-[#5c5750]">
                        {r.images.length} ảnh
                        {(r.bookingCount ?? 0) > 0 ? ` · ${r.bookingCount} đơn đặt` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-black/10 flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={`/rooms/${r.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#5c5750] hover:text-[#8d3f28] inline-flex items-center gap-1 truncate max-w-[180px]"
                    title={`Mở trang phòng /rooms/${r.slug}`}
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">/rooms/{r.slug}</span>
                  </a>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggleRoomActive(r)}
                      className="text-xs py-2 px-2.5 rounded-lg border border-black/15 bg-white hover:bg-[#faf7f1] text-[#3c342e] font-semibold inline-flex items-center gap-1 transition"
                      title={r.isActive ? 'Tạm ẩn khỏi trang khách' : 'Mở hiển thị lại'}
                    >
                      {r.isActive ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          Ẩn
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-700" />
                          Hiện
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setModalError(null);
                        setDraft(roomToDraft(r));
                      }}
                      className="btn btn--secondary text-xs py-2 px-3 inline-flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Sửa & Ảnh
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      data-delete-room-btn={r.slug}
                      onClick={() => setDeletingRoom(r)}
                      className="text-xs py-2 px-2.5 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-700 font-semibold inline-flex items-center gap-1 transition"
                      title={`Xóa ${r.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Room Modal */}
      {draft && (
        <div
          className="fixed inset-0 !mt-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-room-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDraft(null);
          }}
        >
          <form
            onSubmit={saveRoom}
            className="bg-white w-full sm:max-w-5xl rounded-t-2xl sm:rounded-2xl border border-black/10 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
          >
            {/* Sticky Modal Header */}
            <div className="px-6 sm:px-8 py-5 border-b border-black/10 flex items-center justify-between gap-3 bg-white shrink-0">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#8d3f28]">
                  {draft.id === null ? 'Thêm hạng phòng mới' : 'Chỉnh sửa hạng phòng'}
                </span>
                <h3
                  id="edit-room-modal-title"
                  className="font-display text-2xl font-extrabold text-[#221f1c] mt-0.5"
                >
                  {draft.name.trim() || 'Phòng mới tại SEEME'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="w-10 h-10 rounded-lg border border-black/10 flex items-center justify-center text-[#5c5750] hover:bg-[#faf7f1]"
                aria-label="Đóng hộp thoại"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
              {modalError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Row 1: Identity & Slug */}
              <div className="grid sm:grid-cols-2 gap-5 text-sm">
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Tên phòng <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="vd: Phòng Hoa Ban"
                    value={draft.name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setDraft({
                        ...draft,
                        name: nextName,
                        slug: draft.slugTouched ? draft.slug : toSlugPreview(nextName),
                      });
                    }}
                    className="seeme-input h-[46px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Đường dẫn trang phòng (URL slug)
                  </label>
                  <div className="flex items-center seeme-input h-[46px] px-3 gap-1">
                    <span className="text-xs text-[#5c5750] shrink-0">/rooms/</span>
                    <input
                      type="text"
                      placeholder="hoa-ban"
                      value={draft.slug}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          slug: toSlugPreview(e.target.value),
                          slugTouched: true,
                        })
                      }
                      className="w-full bg-transparent outline-none text-sm text-[#221f1c]"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Mô tả ngắn (hiển thị ngay dưới tên phòng) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="vd: Phòng đôi hướng vườn 2 khách · Giường Queen 1,8m x 2m"
                    value={draft.subtitle}
                    onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                    className="seeme-input h-[46px]"
                  />
                </div>
              </div>

              {/* Row 2: Pricing */}
              <div className="grid sm:grid-cols-2 gap-5 text-sm">
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Giá ngày thường (VND / đêm) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={100000}
                    step={10000}
                    value={draft.baseWeekdayPrice}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        baseWeekdayPrice: Number(e.target.value),
                        isPriceConfigured: true,
                      })
                    }
                    className="seeme-input h-[46px] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Giá cuối tuần (VND / đêm) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={100000}
                    step={10000}
                    value={draft.baseWeekendPrice}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        baseWeekendPrice: Number(e.target.value),
                        isPriceConfigured: true,
                      })
                    }
                    className="seeme-input h-[46px] tabular-nums"
                  />
                </div>
              </div>

              {/* Row 3: Capacity, Size & Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Khách tiêu chuẩn
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={draft.standardCapacity}
                    onChange={(e) => {
                      const v = Math.max(1, Number(e.target.value) || 1);
                      setDraft({
                        ...draft,
                        standardCapacity: v,
                        maxCapacity: Math.max(v, draft.maxCapacity),
                      });
                    }}
                    className="seeme-input h-[46px] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Khách tối đa
                  </label>
                  <input
                    type="number"
                    min={draft.standardCapacity}
                    max={20}
                    value={draft.maxCapacity}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        maxCapacity: Math.max(draft.standardCapacity, Number(e.target.value) || 1),
                      })
                    }
                    className="seeme-input h-[46px] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Diện tích (m²)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={draft.sizeSqm ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        sizeSqm: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="seeme-input h-[46px] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Số căn cùng hạng
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={draft.totalUnits}
                    onChange={(e) =>
                      setDraft({ ...draft, totalUnits: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="seeme-input h-[46px] tabular-nums"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Cấu hình giường <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.bedConfig}
                    onChange={(e) => setDraft({ ...draft, bedConfig: e.target.value })}
                    className="seeme-input h-[46px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Phòng tắm
                  </label>
                  <input
                    type="text"
                    value={draft.bathroomType}
                    onChange={(e) => setDraft({ ...draft, bathroomType: e.target.value })}
                    className="seeme-input h-[46px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Hướng nhìn (View)
                  </label>
                  <input
                    type="text"
                    value={draft.viewType}
                    onChange={(e) => setDraft({ ...draft, viewType: e.target.value })}
                    className="seeme-input h-[46px]"
                  />
                </div>
              </div>

              {/* Row 4: Description & Amenities */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Mô tả chi tiết phòng <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={10}
                    placeholder="Giới thiệu không gian, vật liệu gỗ - tường trình đất, tiện nghi giữ ấm..."
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="seeme-textarea"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                      Tiện nghi phòng (ngăn cách bằng dấu phẩy)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Điều hòa 2 chiều, Đèn ngủ, Máy sấy tóc, Bàn trà..."
                      value={draft.amenitiesText}
                      onChange={(e) => setDraft({ ...draft, amenitiesText: e.target.value })}
                      className="seeme-textarea text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                      Điểm nổi bật (mỗi dòng 1 ý)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="WC khép kín riêng tư&#10;Ban công gỗ nhìn ra bản"
                      value={draft.highlightsText}
                      onChange={(e) => setDraft({ ...draft, highlightsText: e.target.value })}
                      className="seeme-textarea text-xs"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#221f1c] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                    className="w-4 h-4 accent-[#8d3f28]"
                  />
                  Hiển thị mở bán phòng này ngay trên trang chủ & lịch đặt phòng
                </label>
              </div>

              {/* Row 5: Photo Library */}
              <div className="space-y-4 pt-4 border-t border-black/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5c5750]">
                    Thư viện ảnh phòng ({draft.images.length} ảnh)
                  </span>
                  <label className="btn btn--secondary text-xs py-2.5 px-4 cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Đang tải lên...' : 'Tải ảnh từ máy'}
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {draft.images.length === 0 ? (
                  <p className="text-xs text-[#5c5750] bg-[#faf7f1] border border-dashed border-black/15 rounded-xl p-4 text-center">
                    Chưa có ảnh nào — bấm “Tải ảnh từ máy” để thêm ảnh thật của phòng (hỗ trợ chọn
                    nhiều ảnh JPG/PNG/WebP cùng lúc).
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {draft.images.map((im, idx) => (
                      <div
                        key={idx}
                        className="border border-black/10 bg-[#faf7f1] rounded-xl p-2.5 space-y-2.5 text-xs"
                      >
                        <img
                          src={im.url}
                          alt={im.altText}
                          className="w-full h-32 sm:h-36 object-cover rounded-lg"
                        />
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                images: draft.images.map((x, j) => ({
                                  ...x,
                                  isPrimary: j === idx,
                                })),
                              })
                            }
                            className={`text-xs px-2 py-1 rounded-md ${
                              im.isPrimary
                                ? 'font-bold text-[#8d3f28] bg-[#ebe3d5]'
                                : 'text-[#5c5750] hover:text-[#221f1c]'
                            }`}
                          >
                            {im.isPrimary ? 'Ảnh đại diện' : 'Đặt đại diện'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                images: draft.images.filter((_, j) => j !== idx),
                              })
                            }
                            className="text-xs font-semibold text-red-700 hover:underline px-2 py-1"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Modal Footer */}
            <div className="px-6 sm:px-8 py-4 border-t border-black/10 bg-[#faf7f1] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="btn btn--secondary text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                data-save-room-btn
                className="btn btn--primary text-sm inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving
                  ? 'Đang lưu...'
                  : draft.id === null
                    ? 'Tạo hạng phòng mới'
                    : 'Lưu thông tin phòng'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Room Confirmation Modal */}
      {deletingRoom && (
        <div
          className="fixed inset-0 !mt-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-room-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingRoom(null);
          }}
        >
          <div className="bg-white w-full max-w-md rounded-2xl border border-black/10 shadow-2xl overflow-hidden">
            <div className="p-6 space-y-3">
              <div className="w-11 h-11 rounded-full bg-red-50 text-red-700 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3
                id="delete-room-modal-title"
                className="font-display text-xl font-extrabold text-[#221f1c]"
              >
                {(deletingRoom.bookingCount ?? 0) > 0
                  ? `Không thể xóa vĩnh viễn ${deletingRoom.name}`
                  : `Xóa ${deletingRoom.name}?`}
              </h3>
              {(deletingRoom.bookingCount ?? 0) > 0 ? (
                <p className="text-sm text-[#47423c] leading-relaxed">
                  Phòng này đang gắn với{' '}
                  <strong className="text-[#221f1c]">
                    {deletingRoom.bookingCount} đơn đặt phòng
                  </strong>{' '}
                  trong lịch sử nên hệ thống không xóa cứng để tránh mất dữ liệu đơn & doanh thu.
                  Bạn có thể chuyển phòng sang trạng thái <strong>Tạm ẩn</strong> để ngừng hiển thị
                  cho khách đặt mới.
                </p>
              ) : (
                <p className="text-sm text-[#47423c] leading-relaxed">
                  Phòng này chưa phát sinh đơn đặt nào. Thao tác này sẽ{' '}
                  <strong className="text-red-700">xóa vĩnh viễn</strong> phòng cùng toàn bộ ảnh và
                  quy tắc giá riêng của phòng khỏi cơ sở dữ liệu.
                </p>
              )}
            </div>

            <div className="px-6 py-4 bg-[#faf7f1] border-t border-black/10 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingRoom(null)}
                className="btn btn--secondary text-xs py-2.5 px-4"
              >
                Hủy
              </button>
              {(deletingRoom.bookingCount ?? 0) > 0 ? (
                <button
                  type="button"
                  disabled={busyRoomId === deletingRoom.id}
                  onClick={() => confirmDeleteRoom(true)}
                  className="btn btn--primary text-xs py-2.5 px-4 inline-flex items-center gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Chuyển sang Tạm ẩn
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyRoomId === deletingRoom.id}
                  data-confirm-delete-room-btn
                  onClick={() => confirmDeleteRoom(false)}
                  className="text-xs font-bold py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {busyRoomId === deletingRoom.id ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminServicesTab({
  services,
  onReload,
}: {
  services: AdminServiceRecord[];
  onReload: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('FOOD');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(350000);
  const [unit, setUnit] = useState('phần');
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, description, price: Number(price), unit }),
    });
    if (res.ok) {
      setName('');
      setDescription('');
      await onReload();
    }
  }

  async function toggleAvail(svc: AdminServiceRecord) {
    setSavingId(svc.id);
    try {
      await fetch('/api/admin/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: svc.id, isAvailable: !svc.isAvailable }),
      });
      await onReload();
    } finally {
      setSavingId(null);
    }
  }

  async function saveInlinePrice(svc: AdminServiceRecord) {
    const parsed = Number(priceDraft);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setSavingId(svc.id);
    try {
      await fetch('/api/admin/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: svc.id, price: parsed }),
      });
      setEditingPriceId(null);
      await onReload();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={addService} className="bg-white rounded-xl border border-black/10 p-5 space-y-3.5">
        <div>
          <h3 className="font-display text-lg text-[#221f1c]">Thêm dịch vụ bổ sung mới</h3>
          <p className="text-xs text-[#5c5750]">
            Dịch vụ hiển thị trực tiếp trong trang đặt phòng để khách chọn kèm khi đặt chỗ.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <input
            type="text"
            placeholder="Tên dịch vụ (vd: Set BBQ bản địa)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="seeme-input h-[44px]"
            required
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="seeme-select h-[44px]"
          >
            <option value="FOOD">Ẩm thực / Lẩu / BBQ</option>
            <option value="EXPERIENCE">Trải nghiệm / Bếp lửa</option>
            <option value="TRANSPORT">Xe máy / Đưa đón</option>
            <option value="ADDON">Tiện ích thêm</option>
          </select>
          <input
            type="number"
            step={5000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="seeme-input h-[44px] tabular-nums"
            required
          />
          <input
            type="text"
            placeholder="Đơn vị (vd: nồi, người, ngày)"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="seeme-input h-[44px]"
            required
          />
          <button type="submit" className="btn btn--primary text-xs h-[44px] inline-flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" />
            Thêm dịch vụ
          </button>
        </div>

        <input
          type="text"
          placeholder="Mô tả ngắn hiển thị cho khách..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="seeme-input h-[44px] text-xs"
          required
        />
      </form>

      <div className="bg-white rounded-xl border border-black/10 divide-y divide-black/10">
        {services.map((sv) => {
          const isEditingPrice = editingPriceId === sv.id;
          return (
            <div
              key={sv.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                {sv.imageUrl && (
                  <img
                    src={sv.imageUrl}
                    alt={sv.imageAlt || sv.name}
                    className="w-14 h-14 rounded-lg object-cover bg-[#ebe3d5] border border-black/10 shrink-0"
                  />
                )}
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-[#221f1c]">{sv.name}</strong>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#ebe3d5] text-[#5c5750]">
                      {SERVICE_CATEGORY_LABELS[sv.category] || sv.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#5c5750]">{sv.description}</p>
                  <span className="inline-block text-xs font-semibold text-[#8d3f28] tabular-nums">
                    {formatVnd(sv.price)} / {sv.unit}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
                {isEditingPrice ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step={5000}
                      value={priceDraft}
                      onChange={(e) => setPriceDraft(e.target.value)}
                      className="seeme-input !w-32 h-[38px] text-xs tabular-nums"
                      aria-label={`Giá mới cho ${sv.name}`}
                    />
                    <button
                      type="button"
                      disabled={savingId === sv.id}
                      onClick={() => void saveInlinePrice(sv)}
                      className="btn btn--primary text-xs py-1.5 px-3"
                    >
                      Lưu
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPriceId(null)}
                      className="btn btn--secondary text-xs py-1.5 px-2.5"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPriceId(sv.id);
                      setPriceDraft(String(sv.price));
                    }}
                    className="btn btn--secondary text-xs py-2 px-3 inline-flex items-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Sửa giá
                  </button>
                )}

                <button
                  type="button"
                  disabled={savingId === sv.id}
                  onClick={() => void toggleAvail(sv)}
                  className={`min-h-[38px] text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                    sv.isAvailable
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-neutral-100 text-neutral-700 border-black/10 hover:bg-neutral-200'
                  }`}
                >
                  {sv.isAvailable ? 'Đang mở đặt' : 'Đang tạm ngưng'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminSettingsTab({
  settings,
  onReload,
}: {
  settings: AllSiteSettings;
  onReload: () => Promise<void>;
}) {
  const [form, setForm] = useState(settings);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  async function saveSection(section: keyof AllSiteSettings) {
    setSavedBanner(null);
    setSavingSection(section);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, value: form[section] }),
      });
      if (res.ok) {
        const names: Record<string, string> = {
          workflow: 'Quy trình đặt phòng',
          payment: 'Tài khoản nhận VietQR',
          policy: 'Chính sách Hoàn / Hủy / Đổi phòng',
        };
        setSavedBanner(`Đã lưu cấu hình: ${names[section] || section}.`);
        await onReload();
      }
    } finally {
      setSavingSection(null);
    }
  }

  return (
    <div className="space-y-5">
      {savedBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Bank / VietQR */}
      <div className="bg-white rounded-xl border border-black/10 p-5 sm:p-6 space-y-4 text-sm">
        <div>
          <h3 className="font-display text-xl text-[#221f1c]">Tài khoản ngân hàng nhận VietQR</h3>
          <p className="text-xs text-[#5c5750] mt-0.5">
            Thông tin này được nhúng trực tiếp vào mã QR thanh toán tự động gửi cho khách.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-[#5c5750] mb-1.5">Mã BIN ngân hàng (vd: 970436 VCB)</label>
            <input
              type="text"
              value={form.payment.bankBin}
              onChange={(e) =>
                setForm({ ...form, payment: { ...form.payment, bankBin: e.target.value } })
              }
              className="seeme-input h-[44px]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#5c5750] mb-1.5">Tên ngân hàng</label>
            <input
              type="text"
              value={form.payment.bankName}
              onChange={(e) =>
                setForm({ ...form, payment: { ...form.payment, bankName: e.target.value } })
              }
              className="seeme-input h-[44px]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#5c5750] mb-1.5">Số tài khoản nhận tiền</label>
            <input
              type="text"
              value={form.payment.accountNo}
              onChange={(e) =>
                setForm({ ...form, payment: { ...form.payment, accountNo: e.target.value } })
              }
              placeholder="Nhập số tài khoản thật của homestay"
              className="seeme-input h-[44px] tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#5c5750] mb-1.5">Tên chủ tài khoản (Không dấu)</label>
            <input
              type="text"
              value={form.payment.accountName}
              onChange={(e) =>
                setForm({ ...form, payment: { ...form.payment, accountName: e.target.value } })
              }
              className="seeme-input h-[44px]"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={savingSection === 'payment'}
          onClick={() => void saveSection('payment')}
          className="btn btn--primary text-xs"
        >
          {savingSection === 'payment' ? 'Đang lưu...' : 'Lưu thông tin tài khoản VietQR'}
        </button>
      </div>

      {/* Configurable Cancellation Policy */}
      <div className="bg-white rounded-xl border border-black/10 p-5 sm:p-6 space-y-4 text-sm">
        <div>
          <h3 className="font-display text-xl text-[#221f1c]">
            Cấu hình Chính sách Hoàn / Hủy / Đổi phòng
          </h3>
          <p className="text-xs text-[#5c5750] mt-0.5">
            Áp dụng đồng nhất trên trang đặt phòng, trang phòng nghỉ và trong snapshot đơn hàng.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-[#5c5750] mb-1.5">Số ngày báo trước để hoàn 100%</label>
            <input
              type="number"
              value={form.policy.fullRefundDaysBefore}
              onChange={(e) =>
                setForm({
                  ...form,
                  policy: { ...form.policy, fullRefundDaysBefore: Number(e.target.value) },
                })
              }
              className="seeme-input h-[44px] tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#5c5750] mb-1.5">Mốc ngày hoàn một phần</label>
            <input
              type="number"
              value={form.policy.partialRefundDaysBefore}
              onChange={(e) =>
                setForm({
                  ...form,
                  policy: { ...form.policy, partialRefundDaysBefore: Number(e.target.value) },
                })
              }
              className="seeme-input h-[44px] tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#5c5750] mb-1.5">% hoàn mốc trung gian</label>
            <input
              type="number"
              value={form.policy.partialRefundPercent}
              onChange={(e) =>
                setForm({
                  ...form,
                  policy: { ...form.policy, partialRefundPercent: Number(e.target.value) },
                })
              }
              className="seeme-input h-[44px] tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#5c5750] mb-1.5">Số phòng tính khách nhóm</label>
            <input
              type="number"
              value={form.policy.groupRoomThreshold}
              onChange={(e) =>
                setForm({
                  ...form,
                  policy: { ...form.policy, groupRoomThreshold: Number(e.target.value) },
                })
              }
              className="seeme-input h-[44px] tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#5c5750] mb-1.5">Ngày báo trước cho nhóm (10–14)</label>
            <input
              type="number"
              min={10}
              max={14}
              value={form.policy.groupMinNoticeDays}
              onChange={(e) =>
                setForm({
                  ...form,
                  policy: { ...form.policy, groupMinNoticeDays: Number(e.target.value) },
                })
              }
              className="seeme-input h-[44px] tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#5c5750] mb-1.5">Thời hạn thanh toán QR (phút)</label>
            <input
              type="number"
              value={form.policy.holdMinutesPayment}
              onChange={(e) =>
                setForm({
                  ...form,
                  policy: { ...form.policy, holdMinutesPayment: Number(e.target.value) },
                })
              }
              className="seeme-input h-[44px] tabular-nums"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#5c5750] mb-1.5">
            Diễn giải quy tắc giao nhau tại mốc 3 ngày, 7 ngày & Lễ/Tết
          </label>
          <textarea
            rows={2}
            value={form.policy.boundaryRuleNote}
            onChange={(e) =>
              setForm({
                ...form,
                policy: { ...form.policy, boundaryRuleNote: e.target.value },
              })
            }
            className="seeme-textarea text-xs"
          />
        </div>

        <button
          type="button"
          disabled={savingSection === 'policy'}
          onClick={() => void saveSection('policy')}
          className="btn btn--primary text-xs"
        >
          {savingSection === 'policy' ? 'Đang lưu...' : 'Lưu cấu hình Chính sách'}
        </button>
      </div>
    </div>
  );
}
