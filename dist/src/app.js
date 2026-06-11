import express from 'express';
import cors from 'cors';
import path from 'path';
import uploadRouter from './routes/upload.routes.js';
import clientRouter from './routes/client.routes.js';
import fileRouter from './routes/file.routes.js';
import adminRouter from './routes/admin.routes.js';
const app = express();
// Middleware Global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Sajikan Dashboard Admin (SPA) secara statis dari folder public
app.use(express.static(path.join(process.cwd(), 'public')));
// Rute API untuk Upload & File Management Klien
app.use('/api', uploadRouter);
app.use('/api', clientRouter);
// Rute API Administratif
app.use('/api/admin', adminRouter);
// Rute Publik untuk static file serving
app.use('/file', fileRouter);
// Handler untuk rute yang tidak terdaftar (404 Not Found)
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Rute API tidak ditemukan'
    });
});
// Centralized Error Handler (Middleware penanganan error terpusat)
app.use((err, req, res, next) => {
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
