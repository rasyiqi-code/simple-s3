import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// Memuat environment variables dari berkas .env
dotenv.config();

// Buat API Key fallback acak yang aman jika tidak diset di .env
const fallbackApiKey = `sk_master_${crypto.randomBytes(16).toString('hex')}`;

// Konfigurasi direktori penyimpanan default
const defaultUploadDir = 'uploads';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY || fallbackApiKey,
  uploadDir: process.env.UPLOAD_DIR || defaultUploadDir,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // Default 50MB
  allowedExtensions: (process.env.ALLOWED_EXTENSIONS || 'jpg,jpeg,png,gif,webp,pdf,mp4,zip,docx,xlsx')
    .split(',')
    .map(ext => ext.trim().toLowerCase()),
  
  // Mendapatkan path absolut direktori upload
  getAbsoluteUploadDir(): string {
    return path.isAbsolute(this.uploadDir)
      ? this.uploadDir
      : path.join(process.cwd(), this.uploadDir);
  },

  // Mendapatkan path absolut untuk direktori temporary upload
  getAbsoluteTempDir(): string {
    return path.join(this.getAbsoluteUploadDir(), 'temp');
  }
};
