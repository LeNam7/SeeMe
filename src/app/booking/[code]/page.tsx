import React from 'react';
import { notFound } from 'next/navigation';
import { asc, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { expireStaleHolds } from '@/lib/booking-engine';
import { getAllSiteSettings } from '@/lib/settings';
import { getExternalVietQrUrl } from '@/lib/vietqr';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { BookingStatusView } from '@/components/BookingStatusView';

export const dynamic = 'force-dynamic';

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await ensureSeeded();
  await expireStaleHolds();

  const { code } = await params;
  const cleanCode = decodeURIComponent(code).trim().toUpperCase();

  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.bookingCode, cleanCode));
  if (!booking) notFound();

  const items = await db
    .select()
    .from(schema.bookingItems)
    .where(eq(schema.bookingItems.bookingId, booking.id));
  const services = await db
    .select()
    .from(schema.bookingServices)
    .where(eq(schema.bookingServices.bookingId, booking.id));
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.bookingId, booking.id))
    .orderBy(desc(schema.payments.id));
  const history = await db
    .select()
    .from(schema.bookingStatusHistory)
    .where(eq(schema.bookingStatusHistory.bookingId, booking.id))
    .orderBy(asc(schema.bookingStatusHistory.createdAt));

  const settings = await getAllSiteSettings();

  const externalQrUrl = payment
    ? getExternalVietQrUrl({
        bankBin: payment.bankBin,
        accountNo: payment.accountNo,
        template: settings.payment.template,
        amount: payment.amount,
        transferContent: payment.transferContent,
        accountName: payment.accountName,
      })
    : null;

  const initialData = {
    booking: {
      ...booking,
      holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
      createdAt: booking.createdAt.toISOString(),
    },
    items,
    services,
    payment: payment
      ? {
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          qrImageUrl: payment.qrImageUrl,
          externalQrUrl,
          bankBin: payment.bankBin,
          bankName: payment.bankName,
          accountNo: payment.accountNo,
          accountName: payment.accountName,
          transferContent: payment.transferContent,
          expiresAt: payment.expiresAt.toISOString(),
          paidAt: payment.paidAt?.toISOString() ?? null,
          transactionRef: payment.transactionRef,
        }
      : null,
    history: history.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actorType: h.actorType,
      actorName: h.actorName,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    brand: settings.brand,
  };

  return (
    <>
      <PublicHeader hotline={settings.brand.hotline} hotlineRaw={settings.brand.hotlineRaw} />
      <main className="pt-24 lg:pt-28 pb-24 lg:pb-16">
        <div className="wrap max-w-5xl">
          <BookingStatusView initialData={initialData} />
        </div>
      </main>
      <PublicFooter brand={settings.brand} />
    </>
  );
}
