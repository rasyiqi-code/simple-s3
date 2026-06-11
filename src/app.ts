import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload.routes.js';
import fileRouter from './routes/file.routes.js';

const app = express();

// Middleware Global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rute API untuk Upload
app.use('/api', uploadRouter);

// Rute Publik untuk static file serving
app.use('/file', fileRouter);

// Handler untuk rute yang tidak terdaftar (404 Not Found)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Rute API tidak ditemukan'
  });
});

// Centralized Error Handler (Middleware penanganan error terpusat)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Terjadi error pada aplikasi:', err);

  // Deteksi error dari library Multer (misalnya: file terlalu besar)
  if (err.message && err.message.includes('Tipe file tidak diizinkan')) {
    res.status(400).json({
      success: false,
      error: err.message
    });
    return;
  }
  
  if (err.name === 'MulterError') {
    let errorMessage = 'Gagal memproses berkas';
    if (err.message === 'File too large') {
      errorMessage = 'Ukuran berkas melebihi batas maksimal (50MB)';
    }
    
    res.status(400).json({
      success: false,
      error: errorMessage,
      details: err.message
    });
    return;
  }

  // Error umum server (500 Internal Server Error)
  res.status(500).json({
    success: false,
    error: 'Terjadi kesalahan internal pada server',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;
