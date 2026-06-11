// server.js — Entry point untuk platform deployment (Hostinger, dll.)
// Menjalankan build otomatis jika dist/src/index.js belum ada,
// kemudian meneruskan eksekusi ke aplikasi utama.

import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entryPoint = join(__dirname, 'dist', 'src', 'index.js');

// Jalankan build jika dist/src/index.js belum ada
if (!existsSync(entryPoint)) {
  console.log('[INFO] dist/src/index.js tidak ditemukan. Menjalankan build TypeScript...');
  try {
    execSync('npx tsc', { stdio: 'inherit', cwd: __dirname });
    console.log('[INFO] Build selesai.');
  } catch (err) {
    console.error('[CRITICAL] Build TypeScript gagal:', err.message);
    process.exit(1);
  }
}

// Import aplikasi utama setelah dipastikan build sudah ada
import(entryPoint).catch((err) => {
  console.error('[CRITICAL] Gagal memuat aplikasi:', err.message);
  process.exit(1);
});
