import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';

// Buat direktori data jika belum ada di root proyek
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inisialisasi database SQLite lokal
const dbPath = path.join(dataDir, 'storage.db');
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

    // 3. Masukkan default API key jika tabel api_keys kosong untuk memudahkan transisi
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
