import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

/**
 * Middleware untuk memvalidasi request menggunakan API Key statis di HTTP header
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

  // Bandingkan dengan API Key yang dikonfigurasi di environment variable
  if (apiKeyHeader !== config.apiKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: API Key tidak valid'
    });
    return;
  }

  // Jika valid, lanjutkan ke handler berikutnya
  next();
}
