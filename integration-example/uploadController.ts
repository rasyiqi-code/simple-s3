import { Request, Response } from 'express';
import {
  uploadToInternalStorage,
  uploadMultipleToInternalStorage,
  deleteFromInternalStorage
} from './storageHelper.js';

// Simulasi ORM database AgencyOS
const db = {
  updateUserAvatar: async (userId: string, avatarUrl: string) => ({ userId, avatarUrl }),
  getUserById: async (userId: string) => ({ id: userId, avatar_url: 'http://localhost:3000/file/old-avatar.webp' }),
  saveProductPhotos: async (productId: string, urls: string[]) => ({ productId, urls })
};

/**
 * CONTOH 1: Handler untuk Unggah Foto Profil Pengguna (Single Upload + Delete File Usang)
 * URL: POST /api/user/avatar (Menggunakan middleware multer.single('avatar') di backend web)
 */
export async function handleUserAvatarUpload(req: Request, res: Response): Promise<void> {
  const { userId } = req.body; // Dapatkan ID pengguna dari request body atau token session

  if (!req.file) {
    res.status(400).json({ success: false, error: 'Harap lampirkan foto profil' });
    return;
  }

  try {
    // 1. Ambil data profil lama dari database untuk mengecek apakah ada foto lama
    const user = await db.getUserById(userId);

    // 2. Kirim buffer berkas baru ke microservice simple-s3 melalui helper
    const uploadResult = await uploadToInternalStorage(
      req.file.buffer,         // Mengambil Buffer file dari multer memoryStorage
      req.file.originalname,   // Nama berkas asli
      req.file.mimetype        // Jenis berkas MIME
    );

    // 3. Simpan URL berkas absolut baru ke database utama web Anda
    await db.updateUserAvatar(userId, uploadResult.url);

    // 4. Bersihkan file lama di VPS agar penyimpanan tidak membengkak
    if (user.avatar_url) {
      // Dapatkan nama berkas lama dari URL (misal: 'old-avatar.webp')
      const oldFilename = user.avatar_url.split('/').pop();
      if (oldFilename) {
        // Hapus file secara aman dari server simple-s3
        await deleteFromInternalStorage(oldFilename);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Foto profil berhasil diperbarui',
      data: {
        avatarUrl: uploadResult.url // URL absolut yang siap dipasang di tag <img> frontend
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Gagal memperbarui foto profil',
      details: error.message
    });
  }
}

/**
 * CONTOH 2: Handler untuk Unggah Galeri Foto Produk (Multiple Upload)
 * URL: POST /api/product/:id/photos (Menggunakan middleware multer.array('photos', 5))
 */
export async function handleProductPhotosUpload(req: Request, res: Response): Promise<void> {
  const { id: productId } = req.params;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ success: false, error: 'Harap sertakan minimal satu foto produk' });
    return;
  }

  try {
    // 1. Teruskan seluruh array berkas ke microservice secara paralel melalui helper
    const uploadResult = await uploadMultipleToInternalStorage(
      files.map(f => ({
        buffer: f.buffer,
        originalname: f.originalname,
        mimetype: f.mimetype
      }))
    );

    // 2. Kumpulkan URL absolut baru hasil unggahan
    const photoUrls = uploadResult.data.map(file => file.url);

    // 3. Simpan relasi foto ke database produk AgencyOS Anda
    await db.saveProductPhotos(productId, photoUrls);

    res.status(200).json({
      success: true,
      message: `${files.length} foto produk berhasil diunggah`,
      data: {
        photoUrls
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Gagal mengunggah galeri foto produk',
      details: error.message
    });
  }
}
