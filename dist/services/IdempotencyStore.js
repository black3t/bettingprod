"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageKey = storageKey;
exports.get = get;
exports.put = put;
const crypto_1 = __importDefault(require("crypto"));
const database_sqlite_1 = require("../config/database-sqlite"); // from P3
const H48 = 48 * 3600 * 1000;
function storageKey(ik, endpoint) {
    const composite = `${ik}::${endpoint}`;
    return crypto_1.default.createHash('sha256').update(composite).digest('hex');
}
async function get(ik, endpoint) {
    if (!database_sqlite_1.db)
        return null;
    const key = storageKey(ik, endpoint);
    const row = await database_sqlite_1.db.get('SELECT response, created_at, expires_at FROM idempotency_keys WHERE key = ?', [key]);
    if (!row)
        return null;
    if (new Date(row.expires_at).getTime() < Date.now())
        return null;
    try {
        const parsed = JSON.parse(row.response);
        if (typeof parsed?.status === 'number' && parsed?.body)
            return { status: parsed.status, body: parsed.body, headers: parsed.headers || {} };
    }
    catch { }
    return null;
}
async function put(ik, endpoint, status, body, headers) {
    if (!database_sqlite_1.db)
        return;
    const key = storageKey(ik, endpoint);
    const payload = JSON.stringify({ v: 1, ik, endpoint, status, body, headers });
    // First write wins (idempotent)
    await database_sqlite_1.db.run("INSERT OR IGNORE INTO idempotency_keys (key, response, created_at, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now','+48 hours'))", [key, payload]);
}
//# sourceMappingURL=IdempotencyStore.js.map