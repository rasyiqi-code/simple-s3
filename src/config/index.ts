import dotenv from 'dotenv';
import path from 'path';

// Memuat environment variables dari berkas .env
dotenv.config();

// Konfigurasi direktori penyimpanan default
const defaultUploadDir = 'uploads';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY || 'local-dev-api-key',
  uploadDir: process.env.UPLOAD_DIR || defaultUploadDir,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // Default 50MB
  maxStorageGb: parseInt(process.env.MAX_STORAGE_GB || '200', 10),
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
