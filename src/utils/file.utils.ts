import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

/**
 * Membuat nama file unik menggunakan kombinasi hash SHA256 dari nama asli + timestamp
 * Format: [sha256-hash]-[timestamp].[ext]
 * 
 * @param originalName Nama asli file dari request upload
 * @returns Nama file unik yang aman untuk disimpan
 */
export function generateUniqueFileName(originalName: string): string {
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
export function getFileExtension(filename: string): string {
  return path.extname(filename).replace('.', '').toLowerCase();
}

/**
 * Validasi apakah nama file aman dari serangan Path Traversal
 * Mencegah karakter seperti "../" atau "..\"
 *
 * @param filename Nama berkas yang diakses/diupload
 * @returns true jika aman, false jika berbahaya
 */
export function isSafeFileName(filename: string): boolean {
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
export function isSafeBucketName(name: string): boolean {
  return /^[a-z0-9_-]{1,63}$/.test(name);
}

/**
 * Mendapatkan informasi kapasitas disk (total dan free space) dalam byte pada direktori target
 *
 * @param targetDir Direktori target yang akan dicek kapasitasnya
 * @returns Objek berisi total dan free space dalam byte
 */
export function getDiskSpaceInfo(targetDir: string): { free: number, total: number } {
  try {
    const stats = fs.statfsSync(targetDir);
    const free = stats.bavail * stats.bsize;
    const total = stats.blocks * stats.bsize;
    return { free, total };
  } catch (error) {
    console.error('[DISK SPACE ERROR] Gagal mendeteksi kapasitas disk:', error);
    // Fallback ke 50 GB free, 100 GB total jika terjadi error pembacaan
    return {
      free: 50 * 1024 * 1024 * 1024,
      total: 100 * 1024 * 1024 * 1024
    };
  }
}

