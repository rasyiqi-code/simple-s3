// server.js — Entry point untuk platform deployment (Hostinger, dll.)
// dist/ sudah di-commit ke repository, jadi tidak perlu build di server.
// Untuk update: jalankan `bun run build` lokal lalu commit dist/ bersama source.

import('./dist/src/index.js').catch((err) => {
  console.error('[CRITICAL] Gagal memuat aplikasi dari dist/src/index.js:', err.message);
  console.error('[INFO] Pastikan dist/ sudah ada di repository (jalankan: bun run build lalu commit)');
  process.exit(1);
});
