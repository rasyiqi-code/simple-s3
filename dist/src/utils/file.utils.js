import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';
/**
 * Membuat nama file unik menggunakan kombinasi hash SHA256 dari nama asli + timestamp
 * Format: [sha256-hash]-[timestamp].[ext]
 *
 * @param originalName Nama asli file dari request upload
 * @returns Nama file unik yang aman untuk disimpan
 */
export function generateUniqueFileName(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, ext);
    // Membuat salt acak untuk memastikan hash selalu unik bahkan jika nama file & waktu sama persis
    const randomSalt = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    // Membuat hash SHA256 dari gabungan nama asli, timestamp, dan salt acak
    const hash = crypto
        .createHash('sha256')
        .update(`${baseName}-${timestamp}-${randomSalt}`)
        .digest('hex');
    // Mengambil 16 karakter pertama dari hash untuk estetika panjang nama file yang wajar
    const shortHash = hash.substring(0, 16);
    return `${shortHash}-${timestamp}${ext}`;
}
/**
 * Mendapatkan ekstensi file dalam format huruf kecil tanpa titik (.)
 * Contoh: "image.PNG" -> "png"
 *
 * @param filename Nama berkas
 * @returns Ekstensi berkas
 */
export function getFileExtension(filename) {
    return path.extname(filename).replace('.', '').toLowerCase();
}
/**
 * Validasi apakah nama file aman dari serangan Path Traversal
 * Mencegah karakter seperti "../" atau "..\"
 *
 * @param filename Nama berkas yang diakses/diupload
 * @returns true jika aman, false jika berbahaya
 */
export function isSafeFileName(filename) {
    // Mengecek apakah nama berkas mengandung karakter traversal atau karakter ilegal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return false;
    }
    return true;
}
/**
 * Validasi nama bucket: hanya boleh huruf kecil, angka, tanda hubung, dan underscore
 * Minimal 1 karakter, maksimal 63 karakter (mengikuti konvensi S3)
 *
 * @param name Nama bucket yang akan divalidasi
 * @returns true jika valid, false jika tidak
 */
export function isSafeBucketName(name) {
    return /^[a-z0-9_-]{1,63}$/.test(name);
}
/**
 * Mendapatkan informasi kapasitas disk (total dan free space) dalam byte pada direktori target
 *
 * @param targetDir Direktori target yang akan dicek kapasitasnya
 * @returns Objek berisi total dan free space dalam byte
 */
export function getDiskSpaceInfo(targetDir) {
    try {
        const stats = fs.statfsSync(targetDir);
        const free = stats.bavail * stats.bsize;
        const total = stats.blocks * stats.bsize;
        return { free, total };
    }
    catch (error) {
        console.error('[DISK SPACE ERROR] Gagal mendeteksi kapasitas disk:', error);
        // Fallback ke 50 GB free, 100 GB total jika terjadi error pembacaan
        return {
            free: 50 * 1024 * 1024 * 1024,
            total: 100 * 1024 * 1024 * 1024
        };
    }
}
/**
 * Mendapatkan total kapasitas yang digunakan oleh seluruh file di direktori home user (atau folder proyek)
 * Menggunakan perintah `du -sb` di sistem Linux untuk performa cepat dan akurat.
 *
 * @returns Ukuran dalam byte
 */
export function getAccountUsedSpace() {
    try {
        const homeDir = os.homedir();
        // Jalankan du -sb pada home directory untuk mendapatkan ukuran total akun dalam byte
        const output = execSync(`du -sb "${homeDir}"`, { timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const match = output.trim().match(/^(\d+)/);
        if (match) {
            return parseInt(match[1], 10);
        }
    }
    catch (error) {
        // Jika home directory tidak bisa diakses/gagal, coba folder proyek saat ini
        try {
            const output = execSync(`du -sb "${process.cwd()}"`, { timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
            const match = output.trim().match(/^(\d+)/);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        catch {
            // Abaikan
        }
    }
    return 0; // Fallback jika gagal total
}
