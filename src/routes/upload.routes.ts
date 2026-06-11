import { Router } from 'express';
import { uploadSingleFile } from '../controllers/upload.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadMiddleware } from '../middlewares/upload.middleware.js';

const router = Router();

/**
 * Route POST /api/upload
 * Memeriksa API key statis di header, memproses unggahan file 'file' dengan Multer,
 * dan melakukan kompresi/penyimpanan permanen di controller.
 */
router.post(
  '/upload',
  authMiddleware,
  uploadMiddleware.single('file'),
  uploadSingleFile
);

export default router;
