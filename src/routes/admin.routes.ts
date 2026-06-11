import { Router } from 'express';
import {
  verifyLogin,
  listKeys,
  createKey,
  deleteKey,
  listFiles,
  deleteFile,
  listLogs
} from '../controllers/admin.controller.js';
import { adminAuthMiddleware } from '../middlewares/adminAuth.js';
import bucketRouter from './bucket.routes.js';

const router = Router();

// Rute login admin tidak dilindungi oleh middleware adminAuth
router.post('/login', verifyLogin);

// Lindungi seluruh rute administratif di bawah ini dengan Master Key validator
router.use(adminAuthMiddleware);

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
