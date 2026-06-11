import { Router } from 'express';
import { uploadSingleFile, uploadMultipleFiles } from '../controllers/upload.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadMiddleware } from '../middlewares/upload.middleware.js';
const router = Router();
// Route POST /api/upload (Tunggal)
router.post('/upload', authMiddleware, uploadMiddleware.single('file'), uploadSingleFile);
// Route POST /api/upload/multiple (Ganda)
router.post('/upload/multiple', authMiddleware, uploadMiddleware.array('files', 10), // Batas maksimal 10 file
uploadMultipleFiles);
export default router;
