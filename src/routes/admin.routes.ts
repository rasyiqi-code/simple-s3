import { Router } from 'express';
import {
  verifyLogin,
  listKeys,
  createKey,
  deleteKey,
  listFiles,
  deleteFile
} from '../controllers/admin.controller.js';
import { adminAuthMiddleware } from '../middlewares/adminAuth.js';

const router = Router();

// Rute login admin tidak dilindungi oleh middleware adminAuth
router.post('/login', verifyLogin);

// Lindungi rute-rute administratif di bawah ini dengan Master Key validator
router.use(adminAuthMiddleware);

// Endpoint manajemen API Keys
router.get('/keys', listKeys);
router.post('/keys', createKey);
router.delete('/keys/:id', deleteKey);

// Endpoint manajemen Files (File Explorer)
router.get('/files', listFiles);
router.delete('/files/:filename', deleteFile);

export default router;
