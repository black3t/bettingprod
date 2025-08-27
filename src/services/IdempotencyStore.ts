import crypto from 'crypto';
import { db } from '../config/database-sqlite'; // from P3

type Stored = { response: string; created_at: string; expires_at: string };
const H48 = 48 * 3600 * 1000;

export function storageKey(ik: string, endpoint: string): string {
  const composite = `${ik}::${endpoint}`;
  return crypto.createHash('sha256').update(composite).digest('hex');
}

export async function get(ik: string, endpoint: string): Promise<{status:number; body:any; headers:Record<string,string>}|null> {
  if (!db) return null;
  const key = storageKey(ik, endpoint);
  const row = await db.get('SELECT response, created_at, expires_at FROM idempotency_keys WHERE key = ?', [key]) as Stored|undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  try {
    const parsed = JSON.parse(row.response);
    if (typeof parsed?.status === 'number' && parsed?.body) return { status: parsed.status, body: parsed.body, headers: parsed.headers || {} };
  } catch {}
  return null;
}

export async function put(ik: string, endpoint: string, status: number, body: any, headers: Record<string,string>): Promise<void> {
  if (!db) return;
  const key = storageKey(ik, endpoint);
  const payload = JSON.stringify({ v:1, ik, endpoint, status, body, headers });
  // First write wins (idempotent)
  await db.run(
    "INSERT OR IGNORE INTO idempotency_keys (key, response, created_at, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now','+48 hours'))",
    [key, payload]
  );
}