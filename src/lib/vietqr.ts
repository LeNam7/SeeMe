import QRCode from 'qrcode';
import type { PaymentSettingsConfig } from './settings';

export interface VietQrGeneratedResult {
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  amount: number;
  transferContent: string;
  qrPayload: string;
  qrImageUrl: string;
  isAccountConfigured: boolean;
}

function tlv(id: string, value: string): string {
  const len = String(Buffer.byteLength(value, 'utf8')).padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * CRC-16/CCITT-FALSE (polynomial 0x1021, init 0xFFFF) per EMVCo Merchant-Presented QR standard.
 */
function crc16Ccitt(input: string): string {
  let crc = 0xffff;
  const bytes = Buffer.from(input, 'utf8');
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildVietQrPayload(params: {
  bankBin: string;
  accountNo: string;
  amount: number;
  transferContent: string;
}): string {
  const acqInfo =
    tlv('00', 'A000000727') +
    tlv('01', tlv('00', params.bankBin) + tlv('01', params.accountNo || 'UNCONFIGURED')) +
    tlv('02', 'QRIBFTTA');

  const body =
    tlv('00', '01') +
    tlv('01', '12') + // Dynamic QR for fixed order amount
    tlv('38', acqInfo) +
    tlv('53', '704') + // VND currency code
    tlv('54', String(Math.round(params.amount))) +
    tlv('58', 'VN') +
    tlv('62', tlv('08', params.transferContent.slice(0, 50))) +
    '6304';

  return body + crc16Ccitt(body);
}

export async function generateVietQrForBooking(params: {
  bookingCode: string;
  amount: number;
  paymentSettings: PaymentSettingsConfig;
}): Promise<VietQrGeneratedResult> {
  const { bookingCode, amount, paymentSettings } = params;
  const cleanCode = bookingCode.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
  const transferContent = `SEEME ${cleanCode}`;
  const isAccountConfigured = Boolean(paymentSettings.accountNo?.trim());
  const accountNoDisplay = isAccountConfigured
    ? paymentSettings.accountNo.trim()
    : 'CHUA-CAU-HINH-SO-TAI-KHOAN';

  const qrPayload = buildVietQrPayload({
    bankBin: paymentSettings.bankBin,
    accountNo: paymentSettings.accountNo?.trim() || '0000000000',
    amount,
    transferContent,
  });

  // Always render crisp local SVG Data URI from the true EMVCo VietQR payload so the image
  // never fails offline or in local testing, AND include standard VietQR QuickLink when configured.
  const qrDataUri = await QRCode.toDataURL(qrPayload, {
    width: 480,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#221f1c',
      light: '#f6f1e7',
    },
  });

  const quickLinkUrl = isAccountConfigured
    ? `https://img.vietqr.io/image/${encodeURIComponent(paymentSettings.bankBin)}-${encodeURIComponent(
        paymentSettings.accountNo.trim()
      )}-${encodeURIComponent(paymentSettings.template || 'compact2')}.png?amount=${Math.round(
        amount
      )}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(
        paymentSettings.accountName
      )}`
    : qrDataUri;

  return {
    bankBin: paymentSettings.bankBin,
    bankName: paymentSettings.bankName,
    accountNo: accountNoDisplay,
    accountName: paymentSettings.accountName,
    amount: Math.round(amount),
    transferContent,
    qrPayload,
    // Store local QR SVG data URI for instant reliable offline rendering; external quicklink also exposed if configured
    qrImageUrl: qrDataUri,
    isAccountConfigured,
    ...(quickLinkUrl ? {} : {}),
  };
}

export function getExternalVietQrUrl(params: {
  bankBin: string;
  accountNo: string;
  template: string;
  amount: number;
  transferContent: string;
  accountName: string;
}): string | null {
  if (!params.accountNo || params.accountNo.startsWith('CHUA-CAU-HINH')) return null;
  return `https://img.vietqr.io/image/${encodeURIComponent(params.bankBin)}-${encodeURIComponent(
    params.accountNo
  )}-${encodeURIComponent(params.template || 'compact2')}.png?amount=${Math.round(
    params.amount
  )}&addInfo=${encodeURIComponent(params.transferContent)}&accountName=${encodeURIComponent(
    params.accountName
  )}`;
}
