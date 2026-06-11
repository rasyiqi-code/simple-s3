import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../config/database.js';
import { config } from '../config/index.js';
import { isSafeBucketName } from '../utils/file.utils.js';

/**
 * Mendapatkan daftar seluruh bucket yang terdaftar
 * GET /api/admin/buckets
 */
export async function listBuckets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const buckets = db.query('SELECT * FROM buckets ORDER BY created_at DESC').all();
    res.status(200).json({
      success: true,
      data: buckets
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Membuat bucket baru (hanya master key)
 * POST /api/admin/buckets
 * Body: { name: string, description?: string }
 */
export async function createBucket(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { name, description = '' } = req.body;

  if (!name || name.trim() === '') {
    res.status(400).json({
      success: false,
      error: 'Nama bucket wajib diisi'
    });
    return;
  }

  const bucketName = name.trim().toLowerCase();

  // Validasi format nama bucket: hanya huruf, angka, tanda hubung, underscore
  if (!isSafeBucketName(bucketName)) {
    res.status(400).json({
      success: false,
      error: 'Nama bucket tidak valid. Gunakan huruf kecil, angka, tanda hubung (-), atau underscore (_) saja'
    });
    return;
  }

  try {
    // Cek apakah nama bucket sudah ada
    const existing = db.prepare('SELECT id FROM buckets WHERE name = ?').get(bucketName);
    if (existing) {
      res.status(409).json({
        success: false,
        error: `Bucket dengan nama "${bucketName}" sudah ada`
      });
      return;
    }

    const createdAt = Date.now();

    // Buat direktori bucket di filesystem
    const bucketDir = path.join(config.getAbsoluteUploadDir(), bucketName);
    await fs.mkdir(bucketDir, { recursive: true });

    // Simpan ke database
    db.run(
      'INSERT INTO buckets (name, description, created_at) VALUES (?, ?, ?)',
      [bucketName, description.trim(), createdAt]
    );

    res.status(201).json({
      success: true,
      message: `Bucket "${bucketName}" berhasil dibuat`,
      data: { name: bucketName, description: description.trim(), createdAt }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Menghapus bucket beserta semua isinya
 * DELETE /api/admin/buckets/:name
 */
export async function deleteBucket(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { name } = req.params;

  if (!isSafeBucketName(name)) {
    res.status(400).json({
      success: false,
      error: 'Nama bucket tidak valid'
    });
    return;
  }

  try {
    const bucket = db.prepare('SELECT * FROM buckets WHERE name = ?').get(name);
    if (!bucket) {
      res.status(404).json({
        success: false,
        error: `Bucket "${name}" tidak ditemukan`
      });
      return;
    }

    // Hapus direktori bucket beserta seluruh isinya dari filesystem
    const bucketDir = path.join(config.getAbsoluteUploadDir(), name);
    await fs.rm(bucketDir, { recursive: true, force: true });

    // Hapus metadata file yang terkait bucket ini dari database
    db.run('DELETE FROM files WHERE bucket_name = ?', [name]);

    // Lepas binding API key dari bucket ini (set null, key tetap ada)
    db.run('UPDATE api_keys SET bucket_name = NULL WHERE bucket_name = ?', [name]);

    // Hapus record bucket
    db.run('DELETE FROM buckets WHERE name = ?', [name]);

    res.status(200).json({
      success: true,
      message: `Bucket "${name}" berhasil dihapus beserta seluruh isinya`
    });
  } catch (error) {
    next(error);
  }
}
