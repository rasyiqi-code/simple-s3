import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';

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
export const db = new Database(dbPath);

console.log(`[DATABASE] Berhasil terhubung ke SQLite: ${dbPath}`);

/**
 * Fungsi untuk menjalankan migrasi awal (pembuatan tabel jika belum ada)
 */
export function runMigrations(): void {
  try {
    // 1. Tabel api_keys: Menyimpan API Key dinamis yang diizinkan untuk mengupload file
    db.run(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_value TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
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

    // 4. Masukkan default API key jika tabel api_keys kosong untuk memudahkan transisi
    const countResult = db.query('SELECT COUNT(*) as count FROM api_keys').get() as { count: number };
    if (countResult && countResult.count === 0) {
      // Masukkan API Key default dari env variable atau generator
      const defaultKey = process.env.API_KEY || 'local-dev-api-key';
      db.run(
        'INSERT INTO api_keys (key_value, name, status, created_at) VALUES (?, ?, ?, ?)',
        [defaultKey, 'Default System Key (Dari Env)', 'active', Date.now()]
      );
      console.log('[DATABASE] API Key default berhasil ditambahkan ke database.');
    }

    console.log('[DATABASE] Migrasi tabel berhasil diperiksa/dijalankan.');
  } catch (error) {
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
export function logActivity(apiKeyName: string, action: string, details: string): void {
  try {
    db.run(
      'INSERT INTO activity_logs (api_key_name, action, details, timestamp) VALUES (?, ?, ?, ?)',
      [apiKeyName, action, details, Date.now()]
    );
  } catch (error) {
    console.error('[DATABASE ERROR] Gagal mencatat log aktivitas:', error);
  }
}
