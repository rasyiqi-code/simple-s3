import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import { getFileExtension } from '../utils/file.utils.js';
// Pastikan folder temp dibuat untuk penampung sementara multer
const tempDir = config.getAbsoluteTempDir();
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}
// Konfigurasi penyimpanan disk sementara untuk multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        // Gunakan nama acak sementara untuk file mentah multer demi keamanan
        const tempName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`;
        cb(null, tempName);
    }
});
// Filter file untuk validasi ekstensi yang diizinkan
const fileFilter = (req, file, cb) => {
    const ext = getFileExtension(file.originalname);
    // Periksa apakah ekstensi file ada dalam daftar yang diizinkan
    if (config.allowedExtensions.includes(ext)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Tipe file tidak diizinkan. Ekstensi yang diperbolehkan: ${config.allowedExtensions.join(', ')}`));
    }
};
// Ekspor instance multer middleware
export const uploadMiddleware = multer({
    storage,
    limits: {
        fileSize: config.maxFileSize // Batasan ukuran file (default 50MB)
    },
    fileFilter
});
