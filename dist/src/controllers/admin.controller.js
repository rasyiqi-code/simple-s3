import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { config } from '../config/index.js';
import { isSafeFileName, getDiskSpaceInfo } from '../utils/file.utils.js';
/**
 * Memverifikasi login dasbor admin menggunakan Master API Key
 * POST /api/admin/login
 */
export async function verifyLogin(req, res) {
    const { masterKey } = req.body;
    if (!masterKey) {
        res.status(400).json({
            success: false,
            error: 'Master API Key wajib disertakan'
        });
        return;
    }
    // Bandingkan dengan API_KEY utama di env
    if (masterKey !== config.apiKey) {
        res.status(401).json({
            success: false,
            error: 'Master API Key tidak valid'
        });
        return;
    }
    res.status(200).json({
        success: true,
        message: 'Login berhasil'
    });
}
/**
 * Mendapatkan daftar seluruh API Key dari database
 * GET /api/admin/keys
 */
export async function listKeys(req, res, next) {
    try {
        const keys = db.query('SELECT * FROM api_keys ORDER BY created_at DESC').all();
        res.status(200).json({
            success: true,
            data: keys
        });
    }
    catch (error) {
        next(error);
    }
}
/**
 * Membuat API Key dinamis baru, wajib terikat ke satu bucket
 * POST /api/admin/keys
 * Body: { name: string, bucket_name: string }
 */
export async function createKey(req, res, next) {
    const { name, bucket_name } = req.body;
    if (!name || name.trim() === '') {
        res.status(400).json({
            success: false,
            error: 'Deskripsi nama API Key wajib diisi'
        });
        return;
    }
    if (!bucket_name || bucket_name.trim() === '') {
        res.status(400).json({
            success: false,
            error: 'bucket_name wajib diisi. API Key harus terikat ke satu bucket.'
        });
        return;
    }
    const bucketNameTrimmed = bucket_name.trim().toLowerCase();
    try {
        // Pastikan bucket yang dimaksud benar-benar ada di database
        const bucketExists = db.prepare('SELECT id FROM buckets WHERE name = ?').get(bucketNameTrimmed);
        if (!bucketExists) {
            res.status(404).json({
                success: false,
                error: `Bucket "${bucketNameTrimmed}" tidak ditemukan. Buat bucket terlebih dahulu.`
            });
            return;
        }
        // Generate token API Key acak sepanjang 32 karakter hex (16 bytes)
        const newKeyValue = `sk_${crypto.randomBytes(16).toString('hex')}`;
        const createdAt = Date.now();
        db.run('INSERT INTO api_keys (key_value, name, status, bucket_name, created_at) VALUES (?, ?, ?, ?, ?)', [newKeyValue, name.trim(), 'active', bucketNameTrimmed, createdAt]);
        res.status(201).json({
            success: true,
            message: 'API Key baru berhasil dibuat',
            data: {
                keyValue: newKeyValue,
                name: name.trim(),
                status: 'active',
                bucketName: bucketNameTrimmed,
                createdAt
            }
        });
    }
    catch (error) {
        next(error);
    }
}
/**
 * Menghapus/menonaktifkan API Key
 * DELETE /api/admin/keys/:id
 */
export async function deleteKey(req, res, next) {
    const { id } = req.params;
    try {
        // Cek apakah key tersebut ada
        const keyRecord = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
        if (!keyRecord) {
            res.status(404).json({
                success: false,
                error: 'API Key tidak ditemukan'
            });
            return;
        }
        db.run('DELETE FROM api_keys WHERE id = ?', [id]);
        res.status(200).json({
            success: true,
            message: 'API Key berhasil dihapus secara permanen'
        });
    }
    catch (error) {
        next(error);
    }
}
/**
 * Mendapatkan daftar seluruh berkas yang tercatat di database
 * GET /api/admin/files
 */
export async function listFiles(req, res, next) {
    try {
        const files = db.query('SELECT * FROM files ORDER BY uploaded_at DESC').all();
        // 1. Hitung total ukuran berkas yang terdaftar di database Simple S3 (dalam byte)
        const totalUsedBytes = files.reduce((acc, f) => acc + f.size, 0);
        // 2. Dapatkan informasi kapasitas disk fisik (total space dan free space) dari sistem operasi
        const diskInfo = getDiskSpaceInfo(config.getAbsoluteUploadDir());
        // 3. Hitung kapasitas yang digunakan oleh OS, instalasi Simple S3, dan project lain di luar file upload Simple S3
        // Rumus: Terpakai Lain = Total Disk - Free Space - Terpakai Simple S3
        const usedOtherDiskBytes = Math.max(0, diskInfo.total - diskInfo.free - totalUsedBytes);
        // 4. Hitung kapasitas penyimpanan total teoretis yang dialokasikan untuk Simple S3
        // Rumus: Total untuk Simple S3 = Total Disk - Terpakai Lain
        const totalStorageBytes = Math.max(0, diskInfo.total - usedOtherDiskBytes);
        res.status(200).json({
            success: true,
            data: files,
            totalUsedBytes,
            freeSpaceBytes: diskInfo.free,
            totalStorageBytes
        });
    }
    catch (error) {
        next(error);
    }
}
/**
 * Menghapus file secara fisik dari disk dan menghapus metadatanya dari database
 * DELETE /api/admin/files/:filename
 */
export async function deleteFile(req, res, next) {
    const { filename } = req.params;
    // 1. Validasi keamanan nama berkas
    if (!isSafeFileName(filename)) {
        res.status(400).json({
            success: false,
            error: 'Nama berkas tidak valid atau tidak aman'
        });
        return;
    }
    try {
        // 2. Cek apakah berkas terdaftar di database
        const fileRecord = db.prepare('SELECT * FROM files WHERE filename = ?').get(filename);
        if (!fileRecord) {
            res.status(404).json({
                success: false,
                error: 'Metadata berkas tidak ditemukan di database'
            });
            return;
        }
        // 3. Hapus berkas secara fisik dari disk jika ada
        const bucketName = fileRecord.bucket_name || 'default';
        const absolutePath = path.join(config.getAbsoluteUploadDir(), bucketName, filename);
        await fs.unlink(absolutePath).catch((err) => {
            console.warn(`[WARNING] Gagal menghapus file fisik di ${absolutePath} (mungkin sudah dihapus manual):`, err.message);
        });
        // 4. Hapus data dari database
        db.run('DELETE FROM files WHERE filename = ?', [filename]);
        res.status(200).json({
            success: true,
            message: 'Berkas berhasil dihapus dari penyimpanan dan database'
        });
    }
    catch (error) {
        next(error);
    }
}
/**
 * Mendapatkan daftar seluruh log aktivitas audit dari database
 * GET /api/admin/logs
 */
export async function listLogs(req, res, next) {
    try {
        const logs = db.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100').all();
        res.status(200).json({
            success: true,
            data: logs
        });
    }
    catch (error) {
        next(error);
    }
}
