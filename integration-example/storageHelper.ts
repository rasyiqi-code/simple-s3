import FormData from 'form-data';
import fetch from 'node-fetch'; // Gunakan fetch bawaan jika menggunakan Node 18+/Bun/Remix

// Konfigurasi koneksi ke Microservice simple-s3
const STORAGE_API_URL = process.env.STORAGE_API_URL || 'http://localhost:3000';
const STORAGE_API_KEY = process.env.STORAGE_API_KEY || 'local-dev-api-key';

interface UploadResult {
  success: boolean;
  url: string;       // URL publik absolut berkas (akses langsung)
  filename: string;  // Nama berkas acak yang disimpan di server storage
  originalName: string;
  mimeType: string;
  size: number;
}

interface MultipleUploadResult {
  success: boolean;
  message: string;
  data: {
    url: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
  }[];
}

/**
 * Mengunggah berkas tunggal ke Microservice Penyimpanan Internal (simple-s3)
 * 
 * @param fileBuffer Buffer data berkas dari Multer/sistem berkas
 * @param originalName Nama asli berkas (misal: 'avatar.png')
 * @param mimeType Jenis berkas MIME (misal: 'image/png')
 * @returns Object berisi detail unggahan dan URL publik berkas
 */
export async function uploadToInternalStorage(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  const formData = new FormData();
  
  // Masukkan data buffer berkas ke form-data
  formData.append('file', fileBuffer, {
    filename: originalName,
    contentType: mimeType
  });

  try {
    const response = await fetch(`${STORAGE_API_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'x-api-key': STORAGE_API_KEY,
        ...formData.getHeaders()
      },
      body: formData
    });

    const body = await response.json() as any;

    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Gagal mengunggah berkas ke storage internal');
    }

    return {
      success: true,
      url: `${STORAGE_API_URL}${body.data.url}`, // Absolute URL: http://storage-domain.com/file/hash.webp
      filename: body.data.filename,
      originalName: body.data.originalName,
      mimeType: body.data.mimeType,
      size: body.data.size
    };
  } catch (error: any) {
    console.error('[STORAGE SERVICE ERROR] Gagal melakukan upload:', error.message);
    throw error;
  }
}

/**
 * Mengunggah banyak berkas secara bersamaan (paralel) ke Microservice Penyimpanan Internal
 * 
 * @param files Array berkas berisi buffer, nama asli, dan jenis mime
 * @returns Array object berisi detail berkas yang berhasil diunggah
 */
export async function uploadMultipleToInternalStorage(
  files: { buffer: Buffer; originalname: string; mimetype: string }[]
): Promise<MultipleUploadResult> {
  const formData = new FormData();

  // Masukkan semua berkas ke form-data dengan key 'files'
  files.forEach((file) => {
    formData.append('files', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype
    });
  });

  try {
    const response = await fetch(`${STORAGE_API_URL}/api/upload/multiple`, {
      method: 'POST',
      headers: {
        'x-api-key': STORAGE_API_KEY,
        ...formData.getHeaders()
      },
      body: formData
    });

    const body = await response.json() as any;

    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Gagal mengunggah berkas ganda');
    }

    // Ubah rute URL relatif menjadi URL absolut
    const formattedData = body.data.map((file: any) => ({
      ...file,
      url: `${STORAGE_API_URL}${file.url}`
    }));

    return {
      success: true,
      message: body.message,
      data: formattedData
    };
  } catch (error: any) {
    console.error('[STORAGE SERVICE ERROR] Gagal melakukan upload multiple:', error.message);
    throw error;
  }
}

/**
 * Menghapus berkas secara terprogram dari penyimpanan internal (simple-s3)
 * 
 * @param filename Nama berkas unik di server storage (misal: 'abc123xyz.webp')
 * @returns true jika berhasil dihapus
 */
export async function deleteFromInternalStorage(filename: string): Promise<boolean> {
  try {
    const response = await fetch(`${STORAGE_API_URL}/api/file/${filename}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': STORAGE_API_KEY
      }
    });

    const body = await response.json() as any;

    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Gagal menghapus berkas dari storage internal');
    }

    return true;
  } catch (error: any) {
    console.error('[STORAGE SERVICE ERROR] Gagal melakukan penghapusan:', error.message);
    return false;
  }
}
