import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import { isSafeFileName, isSafeBucketName } from '../utils/file.utils.js';
const router = Router();
/**
 * Route GET /file/:bucket/:filename
 * Menyajikan berkas statis dari bucket tertentu secara publik.
 * Dilengkapi pencegahan Directory Traversal dan Cache-Control optimal.
 */
router.get('/:bucket/:filename', (req, res) => {
    const { bucket, filename } = req.params;
    // 1. Validasi nama bucket
    if (!isSafeBucketName(bucket)) {
        res.status(400).json({
            success: false,
            error: 'Nama bucket tidak valid'
        });
        return;
    }
    // 2. Validasi keamanan nama berkas (mencegah path traversal)
    if (!isSafeFileName(filename)) {
        res.status(400).json({
            success: false,
            error: 'Nama berkas tidak valid atau tidak aman'
        });
        return;
    }
    const absoluteUploadDir = config.getAbsoluteUploadDir();
    const filePath = path.join(absoluteUploadDir, bucket, filename);
    // 3. Pastikan path yang diakses masih berada di dalam direktori upload (double-check traversal)
    if (!filePath.startsWith(absoluteUploadDir)) {
        res.status(400).json({
            success: false,
            error: 'Akses path tidak diizinkan'
        });
        return;
    }
    // 4. Periksa apakah berkas ada di direktori
    if (!fs.existsSync(filePath)) {
        res.status(404).json({
            success: false,
            error: 'Berkas tidak ditemukan'
        });
        return;
    }
    // 5. Tambahkan HTTP Header Cache-Control yang agresif karena nama berkas unik/hash
    // File statis tidak akan berubah isinya, cache berumur 1 tahun (31536000 detik)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // 6. Kirim berkas ke client
    res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Gagal mengirim berkas ke klien'
            });
        }
    });
});
export default router;
