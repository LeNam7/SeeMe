import path from 'node:path';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type AppDatabase = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

type GlobalDbState = {
  __seemeeDb?: AppDatabase;
  __seemeePglite?: PGlite;
  __seemeePool?: Pool;
  __seemeeInitPromise?: Promise<void>;
  __seemeeWriteQueue?: Promise<unknown>;
};

const g = globalThis as unknown as GlobalDbState;

const DDL_SQL = `
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  description TEXT NOT NULL,
  standard_capacity INTEGER NOT NULL,
  max_capacity INTEGER NOT NULL,
  bed_config TEXT NOT NULL,
  size_sqm INTEGER,
  bathroom_type TEXT NOT NULL,
  view_type TEXT NOT NULL,
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_weekday_price INTEGER NOT NULL,
  base_weekend_price INTEGER NOT NULL,
  total_units INTEGER NOT NULL DEFAULT 1,
  is_price_configured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_images (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  src_set TEXT,
  alt_text TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'stand_in',
  credit_text TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days_of_week JSONB,
  price_mode TEXT NOT NULL DEFAULT 'FIXED',
  amount INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 10,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability_blocks (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  block_date TEXT NOT NULL,
  units_blocked INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT 'OWNER_BLOCK',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS avail_block_room_date_idx ON availability_blocks(room_id, block_date);

CREATE TABLE IF NOT EXISTS extra_services (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL,
  unit TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_alt TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'stand_in',
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_price_configured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_notes TEXT,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  last_stay_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  booking_code TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  check_in_date TEXT NOT NULL,
  check_out_date TEXT NOT NULL,
  nights INTEGER NOT NULL,
  guests_count INTEGER NOT NULL,
  rooms_count INTEGER NOT NULL DEFAULT 1,
  is_whole_house BOOLEAN NOT NULL DEFAULT false,
  room_subtotal INTEGER NOT NULL,
  services_subtotal INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  workflow_mode TEXT NOT NULL DEFAULT 'INSTANT_PAYMENT',
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  expected_check_in_time TEXT,
  room_prep_notes TEXT,
  special_notes TEXT,
  consultation_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  consultation_question TEXT,
  cancellation_policy_agreed BOOLEAN NOT NULL DEFAULT true,
  cancellation_policy_snapshot JSONB NOT NULL,
  hold_expires_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  rejected_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_items (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  room_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  nightly_breakdown JSONB NOT NULL,
  subtotal INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS booking_services (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES extra_services(id) ON DELETE SET NULL,
  service_name_snapshot TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  unit TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS booking_status_history (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'VIETQR',
  transaction_ref TEXT UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL DEFAULT 'AWAITING_TRANSFER',
  qr_image_url TEXT NOT NULL,
  qr_payload TEXT NOT NULL,
  bank_bin TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_no TEXT NOT NULL,
  account_name TEXT NOT NULL,
  transfer_content TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  raw_webhook_payload JSONB,
  verified_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'ZALO_OA',
  event_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNSENT',
  provider_message_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  author_name TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_date TEXT NOT NULL,
  quote TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function getOrCreateDb(): AppDatabase {
  if (g.__seemeeDb) return g.__seemeeDb;

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
    const pool = new Pool({ connectionString: dbUrl });
    g.__seemeePool = pool;
    g.__seemeeDb = drizzlePg(pool, { schema });
    return g.__seemeeDb;
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const dataDir =
    process.env.PGLITE_DATA_DIR ||
    (isServerless ? path.join('/tmp', 'seemee-pgdata') : path.join(process.cwd(), 'data', 'pgdata'));
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const pglite = new PGlite(dataDir);
    g.__seemeePglite = pglite;
    g.__seemeeDb = drizzlePglite(pglite, { schema });
    return g.__seemeeDb;
  } catch {
    // Fallback to in-memory PGlite if filesystem is strictly read-only
    const pglite = new PGlite();
    g.__seemeePglite = pglite;
    g.__seemeeDb = drizzlePglite(pglite, { schema });
    return g.__seemeeDb;
  }
}

export const db: AppDatabase = new Proxy({} as AppDatabase, {
  get(_target, prop) {
    const real = getOrCreateDb() as unknown as Record<string | symbol, unknown>;
    const val = real[prop];
    return typeof val === 'function' ? val.bind(real) : val;
  },
});

async function runRawSql(sqlText: string) {
  getOrCreateDb();
  if (g.__seemeePool) {
    await g.__seemeePool.query(sqlText);
  } else if (g.__seemeePglite) {
    await g.__seemeePglite.exec(sqlText);
  }
}

export async function ensureDbSchema(): Promise<void> {
  if (!g.__seemeeInitPromise) {
    g.__seemeeInitPromise = (async () => {
      await runRawSql(DDL_SQL);
    })();
  }
  await g.__seemeeInitPromise;
}

/**
 * Serializes critical booking/payment mutations in-process (for local PGlite single-file engine)
 * and runs a real PostgreSQL SERIALIZABLE transaction (for both PGlite and remote Postgres).
 */
export async function withSerializedBookingTx<T>(
  fn: (tx: AppDatabase) => Promise<T>
): Promise<T> {
  await ensureDbSchema();
  const prev = g.__seemeeWriteQueue || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  g.__seemeeWriteQueue = prev.then(() => gate).catch(() => gate);

  await prev;
  try {
    const engineDb = getOrCreateDb() as PgliteDatabase<typeof schema>;
    return await engineDb.transaction(
      async (tx) => {
        return await fn(tx as unknown as AppDatabase);
      },
      { isolationLevel: 'serializable' }
    );
  } finally {
    release();
  }
}

export { schema };
