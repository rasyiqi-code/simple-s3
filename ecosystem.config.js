module.exports = {
  apps: [
    {
      name: 'simple-s3',
      // Script utama hasil build yang dijalankan
      script: 'dist/src/index.js',
      // Menjalankan dalam mode fork
      exec_mode: 'fork',
      instances: '1',
      // Melakukan restart otomatis jika aplikasi crash
      autorestart: true,
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
