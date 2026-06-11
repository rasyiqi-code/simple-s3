import fs from 'fs/promises';
import path from 'path';
import { db, logActivity } from '../config/database.js';
import { config } from '../config/index.js';
import { isSafeFileName } from '../utils/file.utils.js';
/**
 * Controller untuk mengizinkan aplikasi klien menghapus berkas menggunakan API Key mereka sendiri
 * Endpoint: DELETE /api/file/:filename
 */
export async function deleteFileByClient(req, res, next) {
    const { filename } = req.params;
    const apiKeyName = req.apiKeyName || 'Client Key';
    // 1. Validasi keamanan nama berkas
    if (!isSafeFileName(filename)) {
        res.status(400).json({
            success: false,
            error: 'Nama berkas tidak valid atau tidak aman'
        });
        return;
    }
    try {
        // 2. Cek apakah berkas ada di database
        const fileRecord = db.prepare('SELECT * FROM files WHERE filename = ?').get(filename);
        if (!fileRecord) {
            res.status(404).json({
                success: false,
                error: 'Berkas tidak ditemukan atau sudah terhapus'
            });
            return;
        }
        // 3. Hapus file secara fisik dari disk
        const absolutePath = path.join(config.getAbsoluteUploadDir(), filename);
        await fs.unlink(absolutePath).catch((err) => {
            console.warn(`[WARNING] Gagal menghapus file fisik di ${absolutePath}:`, err.message);
        });
        // 4. Hapus data dari database SQLite
        db.run('DELETE FROM files WHERE filename = ?', [filename]);
        // 5. Catat tindakan ke audit logs
        logActivity(apiKeyName, 'DELETE_FILE', `Menghapus berkas: ${filename} (Nama Asli: ${fileRecord.original_name})`);
        res.status(200).json({
            success: true,
            message: 'Berkas berhasil dihapus dari penyimpanan server'
        });
    }
    catch (error) {
        next(error);
    }
}
