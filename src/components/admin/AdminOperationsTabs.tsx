'use client';

import React, { useEffect, useState } from 'react';
import { Upload, Plus, Check, Save, Pencil, X } from 'lucide-react';
import { formatVnd } from '@/lib/dates';
import type { AdminRoomRecord, AdminServiceRecord } from './AdminTypes';
import type { AllSiteSettings } from '@/lib/settings';

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  FOOD: 'Ẩm thực / Lẩu / BBQ',
  EXPERIENCE: 'Trải nghiệm / Bếp lửa',
  TRANSPORT: 'Xe máy / Đưa đón',
  ADDON: 'Tiện ích thêm',
};

export function AdminRoomsTab({
  rooms,
  onReload,
}: {
  rooms: AdminRoomRecord[];
  onReload: () => Promise<void>;
}) {
  const [editingRoom, setEditingRoom] = useState<AdminRoomRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!editingRoom) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setEditingRoom(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editingRoom]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingRoom) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setEditingRoom({
          ...editingRoom,
          images: [
            ...editingRoom.images,
            {
              url: data.url,
              altText: `Ảnh thực tế ${editingRoom.name}`,
              sourceType: 'uploaded',
              isPrimary: editingRoom.images.length === 0,
            },
          ],
        });
      }
    } finally {
      setUploading(false);
    }
  }

  async function saveRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRoom) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/rooms/${editingRoom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRoom),
      });
      if (res.ok) {
        setMsg(`Đã lưu thay đổi cho ${editingRoom.name}.`);
        setEditingRoom(null);
        await onReload();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {rooms.map((r) => {
          const thumb = r.images.find((im) => im.isPrimary) ?? r.images[0];
          const isEditing = editingRoom?.id === r.id;
          return (
            <div
              key={r.id}
              className={`bg-white rounded-xl border p-4 sm:p-5 transition ${
                isEditing ? 'border-[#8d3f28] ring-2 ring-[#8d3f28]/15' : 'border-black/10'
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
                    <div className="w-full h-full flex items-center justify-center text-[11px] text-[#5c5750]">
                      Chưa có ảnh
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg text-[#221f1c] leading-snug">{r.name}</h3>
                      <p className="text-xs text-[#5c5750] mt-0.5">{r.subtitle}</p>
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
                      Ngày thường: <strong className="text-[#221f1c]">{formatVnd(r.baseWeekdayPrice)}</strong>
                    </span>
                    <span>
                      Cuối tuần: <strong className="text-[#8d3f28]">{formatVnd(r.baseWeekendPrice)}</strong>
                    </span>
                    <span className="text-[#5c5750]">
                      {r.standardCapacity === r.maxCapacity
                        ? `Tiêu chuẩn ${r.standardCapacity} khách`
                        : `Tiêu chuẩn ${r.standardCapacity}–${r.maxCapacity} khách`}
                    </span>
                    <span className="text-[#5c5750]">{r.images.length} ảnh phòng</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between gap-2">
                <span className="text-xs text-[#5c5750] truncate">{r.bedConfig}</span>
                <button
                  type="button"
                  onClick={() => setEditingRoom(structuredClone(r))}
                  className="btn btn--secondary text-xs py-2 px-3.5 shrink-0 inline-flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Chỉnh sửa & Tải ảnh
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editingRoom && (
        <div
          className="fixed inset-0 !mt-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-room-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingRoom(null);
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
                  Chỉnh sửa hạng phòng
                </span>
                <h3 id="edit-room-modal-title" className="font-display text-2xl font-extrabold text-[#221f1c] mt-0.5">
                  {editingRoom.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="w-10 h-10 rounded-lg border border-black/10 flex items-center justify-center text-[#5c5750] hover:bg-[#faf7f1]"
                aria-label="Đóng hộp thoại chỉnh sửa"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
              <div className="grid sm:grid-cols-2 gap-5 text-sm">
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Tên phòng
                  </label>
                  <input
                    type="text"
                    value={editingRoom.name}
                    onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                    className="seeme-input h-[46px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Cấu hình giường
                  </label>
                  <input
                    type="text"
                    value={editingRoom.bedConfig}
                    onChange={(e) => setEditingRoom({ ...editingRoom, bedConfig: e.target.value })}
                    className="seeme-input h-[46px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Giá ngày thường (VND / đêm)
                  </label>
                  <input
                    type="number"
                    step={10000}
                    value={editingRoom.baseWeekdayPrice}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        baseWeekdayPrice: Number(e.target.value),
                        isPriceConfigured: true,
                      })
                    }
                    className="seeme-input h-[46px] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                    Giá cuối tuần (VND / đêm)
                  </label>
                  <input
                    type="number"
                    step={10000}
                    value={editingRoom.baseWeekendPrice}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        baseWeekendPrice: Number(e.target.value),
                        isPriceConfigured: true,
                      })
                    }
                    className="seeme-input h-[46px] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5c5750] mb-1.5">
                  Mô tả phòng
                </label>
                <textarea
                  rows={4}
                  value={editingRoom.description}
                  onChange={(e) => setEditingRoom({ ...editingRoom, description: e.target.value })}
                  className="seeme-textarea"
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-black/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5c5750]">
                    Thư viện ảnh phòng ({editingRoom.images.length} ảnh)
                  </span>
                  <label className="btn btn--secondary text-xs py-2.5 px-4 cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Đang tải lên...' : 'Tải ảnh từ máy'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {editingRoom.images.map((im, idx) => (
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
                            setEditingRoom({
                              ...editingRoom,
                              images: editingRoom.images.map((x, j) => ({
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
                            setEditingRoom({
                              ...editingRoom,
                              images: editingRoom.images.filter((_, j) => j !== idx),
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
              </div>
            </div>

            {/* Sticky Modal Footer */}
            <div className="px-6 sm:px-8 py-4 border-t border-black/10 bg-[#faf7f1] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="btn btn--secondary text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn--primary text-sm inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Đang lưu...' : 'Lưu thông tin phòng'}
              </button>
            </div>
          </form>
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
