// server.js — Shim entry point untuk platform deployment
// File ini hanya sebagai titik masuk yang diteruskan ke dist/src/index.js
// Pastikan `npm run build` atau `tsc` sudah dijalankan sebelum file ini dieksekusi.

import('./dist/src/index.js').catch((err) => {
  console.error('[CRITICAL] Gagal memuat aplikasi dari dist/src/index.js:', err);
  console.error('[INFO] Pastikan build sudah dijalankan: npm run build');
  process.exit(1);
});
