import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { generateUniqueFileName, getFileExtension } from '../utils/file.utils.js';
import { isImageFile, optimizeImageToWebP } from '../utils/optimizer.utils.js';

/**
 * Controller untuk menangani unggahan berkas tunggal (Single File Upload)
 * Endpoint: POST /api/upload
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

  const tempFilePath = req.file.path;
  const originalName = req.file.originalname;
  const ext = getFileExtension(originalName);

  try {
    const uploadDir = config.getAbsoluteUploadDir();
    
    // Pastikan direktori tujuan penyimpanan permanen sudah dibuat
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate nama file unik yang baru
    let finalFileName = generateUniqueFileName(originalName);
    let finalPath = path.join(uploadDir, finalFileName);
    let finalSize = req.file.size;
    let finalMimeType = req.file.mimetype;

    // Jika file adalah gambar, lakukan optimasi dan konversi ke .webp
    if (isImageFile(ext)) {
      const optimizationResult = await optimizeImageToWebP(
        tempFilePath,
        uploadDir,
        finalFileName
      );
      
      finalPath = optimizationResult.outputPath;
      finalFileName = optimizationResult.filename;
      finalSize = optimizationResult.size;
      finalMimeType = 'image/webp'; // mime-type berubah menjadi webp karena hasil konversi

      // Hapus file asli di folder temporary setelah sukses dioptimasi
      await fs.unlink(tempFilePath).catch((err) => {
        console.error(`Gagal menghapus file temporary: ${tempFilePath}`, err);
      });
    } else {
      // Jika bukan file gambar, pindahkan langsung dari folder temp ke permanen
      await fs.rename(tempFilePath, finalPath);
    }

    // Bangun URL akses publik file
    // Menyediakan absolute path relatif dari hostname
    const fileUrl = `/file/${finalFileName}`;

    res.status(201).json({
      success: true,
      message: 'Berkas berhasil diunggah dan disimpan',
      data: {
        originalName,
        filename: finalFileName,
        mimeType: finalMimeType,
        size: finalSize,
        url: fileUrl
      }
    });

  } catch (error) {
    // Bersihkan file sementara jika terjadi kegagalan sistem agar penyimpanan tidak penuh
    await fs.unlink(tempFilePath).catch(() => {});
    
    // Kirim error ke global error handler Express
    next(error);
  }
}
