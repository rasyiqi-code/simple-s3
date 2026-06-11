import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import { isSafeFileName } from '../utils/file.utils.js';
const router = Router();
/**
 * Route GET /file/:filename
 * Menyajikan berkas statis secara publik untuk klien.
 * Dilengkapi dengan pencegahan Directory Traversal dan pengaturan Cache-Control yang optimal.
 */
router.get('/:filename', (req, res) => {
    const { filename } = req.params;
    // 1. Validasi keamanan nama berkas (mencegah path traversal)
    if (!isSafeFileName(filename)) {
        res.status(400).json({
            success: false,
            error: 'Nama berkas tidak valid atau tidak aman'
        });
        return;
    }
    const absoluteUploadDir = config.getAbsoluteUploadDir();
    const filePath = path.join(absoluteUploadDir, filename);
    // 2. Periksa apakah berkas ada di direktori
    if (!fs.existsSync(filePath)) {
        res.status(404).json({
            success: false,
            error: 'Berkas tidak ditemukan'
        });
        return;
    }
    // 3. Tambahkan HTTP Header Cache-Control yang agresif karena nama berkas unik/hash
    // file statis tidak akan berubah isinya, cache berumur 1 tahun (31536000 detik)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // 4. Kirim berkas ke client
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
