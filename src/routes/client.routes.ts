import { Router } from 'express';
import { deleteFileByClient } from '../controllers/client.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Endpoint client API untuk menghapus berkas menggunakan API Key valid
router.delete('/file/:filename', authMiddleware, deleteFileByClient);

export default router;
