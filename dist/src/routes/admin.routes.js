import { Router } from 'express';
import { verifyLogin, listKeys, createKey, deleteKey, listFiles, deleteFile, listLogs } from '../controllers/admin.controller.js';
import { adminAuthMiddleware } from '../middlewares/adminAuth.js';
import bucketRouter from './bucket.routes.js';
import { config } from '../config/index.js';
const router = Router();
// Rute login admin tidak dilindungi oleh middleware adminAuth
router.post('/login', verifyLogin);
// Lindungi seluruh rute administratif di bawah ini dengan Master Key validator
router.use(adminAuthMiddleware);
// Rute debug konfigurasi aktif (untuk mendiagnosis path database/uploads)
router.get('/debug-config', (req, res) => {
    res.status(200).json({
        success: true,
        cwd: process.cwd(),
        nodeEnv: process.env.NODE_ENV,
        config: {
            databaseDir: config.databaseDir,
            uploadDir: config.uploadDir,
            absoluteDatabaseDir: config.getAbsoluteDatabaseDir(),
            absoluteUploadDir: config.getAbsoluteUploadDir(),
            databasePath: config.getDatabasePath()
        },
        envKeysPresent: {
            DATABASE_DIR: !!process.env.DATABASE_DIR,
            UPLOAD_DIR: !!process.env.UPLOAD_DIR,
            BACKUP_DIR: !!process.env.BACKUP_DIR,
            API_KEY: !!process.env.API_KEY
        }
    });
});
// Endpoint manajemen Bucket
router.use('/buckets', bucketRouter);
// Endpoint manajemen API Keys
router.get('/keys', listKeys);
router.post('/keys', createKey);
router.delete('/keys/:id', deleteKey);
// Endpoint manajemen Files (File Explorer)
router.get('/files', listFiles);
router.delete('/files/:filename', deleteFile);
// Endpoint log audit aktivitas
router.get('/logs', listLogs);
export default router;
