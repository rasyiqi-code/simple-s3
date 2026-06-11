import { Router } from 'express';
import { listBuckets, createBucket, deleteBucket } from '../controllers/bucket.controller.js';
const router = Router();
// Endpoint manajemen Bucket (semua dilindungi adminAuth dari parent router)
router.get('/', listBuckets);
router.post('/', createBucket);
router.delete('/:name', deleteBucket);
export default router;
