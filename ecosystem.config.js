module.exports = {
  apps: [
    {
      name: 'simple-s3',
      // Script utama yang dijalankan
      script: 'src/index.ts',
      // Menggunakan Bun sebagai interpreter untuk mengeksekusi TypeScript secara langsung
      interpreter: 'bun',
      // Menjalankan dalam mode fork. (Bun dapat berjalan lebih stabil dalam mode fork pada beberapa versi PM2)
      exec_mode: 'fork',
      instances: '1',
      // Melakukan restart otomatis jika aplikasi crash
      autorestart: true,
      // Memantau perubahan file untuk restart otomatis di development (opsional, default dimatikan untuk prod)
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
