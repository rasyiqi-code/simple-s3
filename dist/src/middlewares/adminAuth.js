import { config } from '../config/index.js';
/**
 * Middleware untuk memvalidasi akses dasbor admin menggunakan Master API Key
 * Header yang dicari: x-admin-key
 */
export function adminAuthMiddleware(req, res, next) {
    const adminKeyHeader = req.headers['x-admin-key'];
    // 1. Cek apakah Master API Key disertakan pada header
    if (!adminKeyHeader) {
        res.status(401).json({
            success: false,
            error: 'Unauthorized: Kunci admin tidak ditemukan pada header x-admin-key'
        });
        return;
    }
    // 2. Cocokkan dengan Master API Key yang dikonfigurasi di berkas .env
    if (adminKeyHeader !== config.apiKey) {
        res.status(401).json({
            success: false,
            error: 'Unauthorized: Kunci admin tidak valid'
        });
        return;
    }
    // Lanjutkan jika berhasil divalidasi
    next();
}
