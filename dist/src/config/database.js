import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config } from './index.js';
// Buat direktori data jika belum ada di root proyek
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
// Deteksi environment untuk menentukan nama database
// Menggunakan storage_test.db saat testing agar tidak merusak data development
const isTestEnv = process.env.NODE_ENV === 'test' || globalThis.process?.env?.NODE_ENV === 'test';
const dbName = isTestEnv ? 'storage_test.db' : 'storage.db';
const dbPath = path.join(dataDir, dbName);
// Inisialisasi koneksi node:sqlite bawaan Node.js
const rawDb = new DatabaseSync(dbPath);
// Wrapper objek db agar kompatibel dengan API bun:sqlite yang digunakan di controller/middleware
export const db = {
    run(sql, params = []) {
        const stmt = rawDb.prepare(sql);
        return stmt.run(...params);
    },
    prepare(sql) {
        return rawDb.prepare(sql);
    },
    query(sql) {
        const stmt = rawDb.prepare(sql);
        return {
            get(...params) {
                return stmt.get(...params);
            },
            all(...params) {
                return stmt.all(...params);
            }
        };
    }
};
console.log(`[DATABASE] Berhasil terhubung ke SQLite: ${dbPath}`);
/**
 * Fungsi untuk menjalankan migrasi awal (pembuatan tabel jika belum ada)
 */
export function runMigrations() {
    try {
        // 1. Tabel api_keys: Menyimpan API Key dinamis yang diizinkan untuk mengupload file
        db.run(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_value TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        bucket_name TEXT,
        created_at INTEGER NOT NULL
      )
    `);
        // 2. Tabel files: Menyimpan metadata file yang berhasil diunggah
        db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_name TEXT NOT NULL,
        filename TEXT UNIQUE NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        bucket_name TEXT DEFAULT 'default',
        uploaded_at INTEGER NOT NULL
      )
    `);
        // 3. Tabel activity_logs: Menyimpan log audit keamanan sistem
        db.run(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_key_name TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
        // 4. Tabel buckets: Menyimpan daftar bucket penyimpanan
        db.run(`
      CREATE TABLE IF NOT EXISTS buckets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        created_at INTEGER NOT NULL
      )
    `);
        // 5. Migrasi kolom baru untuk tabel yang sudah ada (backward-compatible)
        // SQLite tidak support IF NOT EXISTS pada ALTER TABLE, gunakan try/catch per kolom
        try {
            db.run('ALTER TABLE api_keys ADD COLUMN bucket_name TEXT');
            console.log('[DATABASE] Kolom bucket_name berhasil ditambahkan ke api_keys.');
        }
        catch {
            // Kolom sudah ada, lewati
        }
        try {
            db.run("ALTER TABLE files ADD COLUMN bucket_name TEXT DEFAULT 'default'");
            console.log('[DATABASE] Kolom bucket_name berhasil ditambahkan ke files.');
        }
        catch {
            // Kolom sudah ada, lewati
        }
        // 6. Masukkan default bucket 'default' jika tabel buckets kosong
        const countBuckets = db.query('SELECT COUNT(*) as count FROM buckets').get();
        if (countBuckets && countBuckets.count === 0) {
            const createdAt = Date.now();
            db.run("INSERT INTO buckets (name, description, created_at) VALUES ('default', 'Default storage bucket', ?)", [createdAt]);
            console.log("[DATABASE] Bucket 'default' berhasil ditambahkan.");
            // Buat folder fisik untuk bucket default di dalam folder uploads
            const defaultDir = path.join(config.getAbsoluteUploadDir(), 'default');
            if (!fs.existsSync(defaultDir)) {
                fs.mkdirSync(defaultDir, { recursive: true });
            }
        }
        // 7. Masukkan default API key jika tabel api_keys kosong untuk memudahkan transisi
        const countResult = db.query('SELECT COUNT(*) as count FROM api_keys').get();
        if (countResult && countResult.count === 0) {
            // Masukkan API Key default dari env variable atau generator
            const defaultKey = process.env.API_KEY || 'local-dev-api-key';
            db.run("INSERT INTO api_keys (key_value, name, status, bucket_name, created_at) VALUES (?, ?, ?, 'default', ?)", [defaultKey, 'Default System Key (Dari Env)', 'active', Date.now()]);
            console.log('[DATABASE] API Key default berhasil ditambahkan ke database (terikat ke bucket default).');
        }
        console.log('[DATABASE] Migrasi tabel berhasil diperiksa/dijalankan.');
    }
    catch (error) {
        console.error('[DATABASE] Gagal menjalankan migrasi database:', error);
        process.exit(1);
    }
}
/**
 * Helper untuk menyisipkan log audit ke dalam tabel activity_logs
 *
 * @param apiKeyName Nama/deskripsi dari API key yang digunakan
 * @param action Nama aksi (misal: UPLOAD_SINGLE, DELETE_FILE)
 * @param details Keterangan tambahan aksi (seperti nama berkas, ukuran, dll.)
 */
export function logActivity(apiKeyName, action, details) {
    try {
        db.run('INSERT INTO activity_logs (api_key_name, action, details, timestamp) VALUES (?, ?, ?, ?)', [apiKeyName, action, details, Date.now()]);
    }
    catch (error) {
        console.error('[DATABASE ERROR] Gagal mencatat log aktivitas:', error);
    }
}
