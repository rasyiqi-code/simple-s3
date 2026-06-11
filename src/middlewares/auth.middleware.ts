import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database.js';

/**
 * Middleware untuk memvalidasi request menggunakan API Key dinamis dari database SQLite
 * Header yang digunakan: x-api-key
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKeyHeader = req.headers['x-api-key'];

  // Cek apakah API Key disertakan dalam header
  if (!apiKeyHeader) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: API Key tidak ditemukan pada header x-api-key'
    });
    return;
  }

  try {
    // Cari API Key di database SQLite yang memiliki status 'active'
    const query = db.prepare('SELECT * FROM api_keys WHERE key_value = ? AND status = ?');
    const apiKeyRecord = query.get(apiKeyHeader as string, 'active') as any;

    if (!apiKeyRecord) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: API Key tidak valid atau telah dinonaktifkan'
      });
      return;
    }

    // Simpan metadata API Key ke dalam object request Express untuk log audit
    (req as any).apiKeyName = apiKeyRecord.name;

    // Jika valid, lanjutkan ke handler berikutnya
    next();
  } catch (error) {
    console.error('[AUTH MIDDLEWARE] Gagal memverifikasi API Key:', error);
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan internal saat memproses autentikasi'
    });
  }
}
