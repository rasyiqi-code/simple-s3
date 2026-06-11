import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { db, logActivity } from '../config/database.js';
import { generateUniqueFileName, getFileExtension } from '../utils/file.utils.js';
import { isImageFile, optimizeImageToWebP } from '../utils/optimizer.utils.js';

/**
 * Memvalidasi bahwa API key memiliki bucket yang terikat sebelum upload
 * Mengembalikan nama bucket jika valid, null jika tidak
 */
function resolveBucket(req: Request, res: Response): string | null {
  const bucketName = (req as any).bucketName as string | null;

  if (!bucketName) {
    res.status(403).json({
      success: false,
      error: 'API Key ini tidak terikat ke bucket manapun. Hubungi admin untuk assign bucket.'
    });
    return null;
  }

  return bucketName;
}

/**
 * Controller untuk menangani unggahan berkas tunggal (Single File Upload)
 * Endpoint: POST /api/upload
 * Bucket diambil otomatis dari API Key yang digunakan
 */
export async function uploadSingleFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Pastikan berkas berhasil diunggah oleh multer
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: 'Harap lampirkan berkas yang akan diunggah dengan field name: file'
    });
    return;
  }

  // Resolve bucket dari API key
  const bucketName = resolveBucket(req, res);
  if (!bucketName) return;

  const tempFilePath = req.file.path;
  const originalName = req.file.originalname;
  const ext = getFileExtension(originalName);
  const apiKeyName = (req as any).apiKeyName || 'Master Key / Admin';

  try {
    // Direktori target adalah subfolder bucket di dalam uploadDir
    const uploadDir = path.join(config.getAbsoluteUploadDir(), bucketName);
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate nama file unik
    let finalFileName = generateUniqueFileName(originalName);
    let finalPath = path.join(uploadDir, finalFileName);
    let finalSize = req.file.size;
    let finalMimeType = req.file.mimetype;

    // Jika file adalah gambar, lakukan optimasi dan konversi ke .webp
    if (isImageFile(ext)) {
      try {
        const optimizationResult = await optimizeImageToWebP(
          tempFilePath,
          uploadDir,
          finalFileName
        );

        finalPath = optimizationResult.outputPath;
        finalFileName = optimizationResult.filename;
        finalSize = optimizationResult.size;
        finalMimeType = 'image/webp';

        await fs.unlink(tempFilePath).catch((err) => {
          console.error(`Gagal menghapus file temporary: ${tempFilePath}`, err);
        });
      } catch (optError) {
        console.error('[OPTIMIZATION WARNING] Gagal mengoptimalkan gambar dengan sharp, menggunakan file asli:', optError);
        // Fallback: Pindahkan file temporary asli ke path target tanpa optimasi
        finalPath = path.join(uploadDir, finalFileName);
        await fs.rename(tempFilePath, finalPath);
      }
    } else {
      await fs.rename(tempFilePath, finalPath);
    }

    // Catat metadata file ke database SQLite beserta nama bucket
    db.run(
      'INSERT INTO files (original_name, filename, mime_type, size, bucket_name, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)',
      [originalName, finalFileName, finalMimeType, finalSize, bucketName, Date.now()]
    );

    logActivity(
      apiKeyName,
      'UPLOAD_SINGLE',
      `Bucket: ${bucketName} | Unggah berkas: ${originalName} (Disimpan sebagai: ${finalFileName}, Ukuran: ${finalSize} bytes)`
    );

    const fileUrl = `/file/${bucketName}/${finalFileName}`;

    res.status(201).json({
      success: true,
      message: 'Berkas berhasil diunggah dan disimpan',
      data: {
        originalName,
        filename: finalFileName,
        mimeType: finalMimeType,
        size: finalSize,
        bucket: bucketName,
        url: fileUrl
      }
    });

  } catch (error) {
    await fs.unlink(tempFilePath).catch(() => {});
    next(error);
  }
}

/**
 * Controller untuk menangani unggahan berkas ganda (Multiple File Upload) secara paralel
 * Endpoint: POST /api/upload/multiple
 * Bucket diambil otomatis dari API Key yang digunakan
 */
export async function uploadMultipleFiles(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const files = req.files as Express.Multer.File[];

  // Pastikan berkas berhasil diunggah oleh multer
  if (!files || files.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Harap lampirkan berkas-berkas yang akan diunggah dengan field name: files'
    });
    return;
  }

  // Resolve bucket dari API key
  const bucketName = resolveBucket(req, res);
  if (!bucketName) return;

  const apiKeyName = (req as any).apiKeyName || 'Master Key / Admin';
  const uploadDir = path.join(config.getAbsoluteUploadDir(), bucketName);
  const processedFiles: any[] = [];

  try {
    await fs.mkdir(uploadDir, { recursive: true });

    // Proses semua file secara paralel menggunakan Promise.all demi performa maksimal
    await Promise.all(
      files.map(async (file) => {
        const tempFilePath = file.path;
        const originalName = file.originalname;
        const ext = getFileExtension(originalName);

        let finalFileName = generateUniqueFileName(originalName);
        let finalPath = path.join(uploadDir, finalFileName);
        let finalSize = file.size;
        let finalMimeType = file.mimetype;

        if (isImageFile(ext)) {
          try {
            const optimizationResult = await optimizeImageToWebP(
              tempFilePath,
              uploadDir,
              finalFileName
            );

            finalPath = optimizationResult.outputPath;
            finalFileName = optimizationResult.filename;
            finalSize = optimizationResult.size;
            finalMimeType = 'image/webp';

            await fs.unlink(tempFilePath).catch(() => {});
          } catch (optError) {
            console.error('[OPTIMIZATION WARNING] Gagal mengoptimalkan gambar dengan sharp, menggunakan file asli:', optError);
            finalPath = path.join(uploadDir, finalFileName);
            await fs.rename(tempFilePath, finalPath);
          }
        } else {
          await fs.rename(tempFilePath, finalPath);
        }

        // Catat metadata file ke database SQLite beserta nama bucket
        db.run(
          'INSERT INTO files (original_name, filename, mime_type, size, bucket_name, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)',
          [originalName, finalFileName, finalMimeType, finalSize, bucketName, Date.now()]
        );

        processedFiles.push({
          originalName,
          filename: finalFileName,
          mimeType: finalMimeType,
          size: finalSize,
          bucket: bucketName,
          url: `/file/${bucketName}/${finalFileName}`
        });
      })
    );

    logActivity(
      apiKeyName,
      'UPLOAD_MULTIPLE',
      `Bucket: ${bucketName} | Unggah ${files.length} berkas secara paralel. Berkas: ${processedFiles.map(f => f.originalName).join(', ')}`
    );

    res.status(201).json({
      success: true,
      message: `${files.length} berkas berhasil diunggah dan disimpan`,
      data: processedFiles
    });

  } catch (error) {
    // Bersihkan semua file temp yang tersisa jika proses gagal tengah jalan
    for (const file of files) {
      await fs.unlink(file.path).catch(() => {});
    }
    next(error);
  }
}
