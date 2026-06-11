import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Fungsi untuk men-generate API_KEY secara otomatis di file .env jika kosong
function ensureEnvApiKey(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Pola regex untuk mendeteksi API_KEY= (kosong atau hanya berisi whitespace/komentar)
    const apiKeyRegex = /^API_KEY=\s*$/m;
    
    if (apiKeyRegex.test(envContent) || !envContent.includes('API_KEY=')) {
      const generatedKey = `sk_master_${crypto.randomBytes(16).toString('hex')}`;
      
      if (envContent.includes('API_KEY=')) {
        envContent = envContent.replace(apiKeyRegex, `API_KEY=${generatedKey}`);
      } else {
        envContent += `\nAPI_KEY=${generatedKey}`;
      }
      
      fs.writeFileSync(envPath, envContent, 'utf8');
      process.env.API_KEY = generatedKey;
      
      console.log(`\n================================================================`);
      console.log(`[ENV CONFIG] API_KEY kosong terdeteksi di .env!`);
      console.log(`👉 Berhasil men-generate dan menyimpan Master API Key baru ke .env:`);
      console.log(`   ${generatedKey}`);
      console.log(`================================================================\n`);
    }
  } catch (error) {
    console.error('[ENV CONFIG WARNING] Gagal memperbarui API_KEY di .env:', error);
  }
}

// Jalankan pemeriksaan otomatis sebelum memuat dotenv
ensureEnvApiKey();

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
