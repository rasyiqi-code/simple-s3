import fs from 'fs';
import app from './app.js';
import { config } from './config/index.js';
import { runMigrations } from './config/database.js';

// Jalankan migrasi database SQLite
runMigrations();

// Fungsi untuk memastikan folder penyimpanan permanen dan temporary sudah ada sebelum server berjalan
function initializeDirectories(): void {
  const uploadDir = config.getAbsoluteUploadDir();
  const tempDir = config.getAbsoluteTempDir();

  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`[INFO] Direktori penyimpanan permanen berhasil dibuat: ${uploadDir}`);
    }

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`[INFO] Direktori penyimpanan temporary berhasil dibuat: ${tempDir}`);
    }
  } catch (err) {
    console.error('[CRITICAL] Gagal membuat direktori penyimpanan:', err);
    process.exit(1);
  }
}

// Jalankan inisialisasi folder
initializeDirectories();

// Jalankan server Express
const server = app.listen(config.port, () => {
  console.log(`[SUCCESS] Server berjalan pada mode [${config.nodeEnv}]`);
  console.log(`[SUCCESS] Storage API Service dapat diakses di http://localhost:${config.port}`);
  console.log(`[INFO] Batas maksimal ukuran file: ${(config.maxFileSize / (1024 * 1024)).toFixed(0)}MB`);
});

// Menangani shutdown secara graceful
process.on('SIGTERM', () => {
  console.log('[INFO] Menerima SIGTERM, menutup server secara graceful...');
  server.close(() => {
    console.log('[INFO] Server ditutup.');
    process.exit(0);
  });
});
