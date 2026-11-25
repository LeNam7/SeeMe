import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { eq, gt, and } from 'drizzle-orm';
import { db, ensureDbSchema, schema } from '@/db';

export const ADMIN_COOKIE_NAME = 'seemee_admin_session';
const SESSION_TTL_HOURS = 48;

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || 'seemee-dev-session-secret-change-in-prod';
}

export function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() || 'admin';
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || 'seemee-admin-change-me';
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUser = getAdminUsername();
  const expectedPass = getAdminPassword();
  const uMatch =
    username.length === expectedUser.length &&
    crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser));
  const pMatch =
    password.length === expectedPass.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass));
  return uMatch && pMatch;
}

function signSessionId(sessionId: string): string {
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(sessionId)
    .digest('hex');
  return `${sessionId}.${sig}`;
}

function verifySignedToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [sessionId, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(sessionId)
    .digest('hex');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  return sessionId;
}

export async function createAdminSession(username: string): Promise<{ token: string; expiresAt: Date }> {
  await ensureDbSchema();
  const sessionId = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000);
  await db.insert(schema.adminSessions).values({
    id: sessionId,
    username,
    expiresAt,
  });
  return { token: signSessionId(sessionId), expiresAt };
}

export async function getAdminSession(): Promise<{ username: string; sessionId: string } | null> {
  await ensureDbSchema();
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!raw) return null;
  const sessionId = verifySignedToken(raw);
  if (!sessionId) return null;

  const [session] = await db
    .select()
    .from(schema.adminSessions)
    .where(and(eq(schema.adminSessions.id, sessionId), gt(schema.adminSessions.expiresAt, new Date())));

  if (!session) return null;
  return { username: session.username, sessionId: session.id };
}

export async function destroyAdminSession(): Promise<void> {
  await ensureDbSchema();
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!raw) return;
  const sessionId = verifySignedToken(raw);
  if (sessionId) {
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, sessionId));
  }
}

export function computeWebhookSignature(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifyWebhookSignature(rawBody: string, providedSig: string | null): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() || 'seemee-webhook-dev-secret';
  if (!providedSig) return false;
  const cleanProvided = providedSig.replace(/^sha256=/i, '').trim().toLowerCase();
  const expected = computeWebhookSignature(rawBody, secret).toLowerCase();
  if (cleanProvided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(cleanProvided), Buffer.from(expected));
}
