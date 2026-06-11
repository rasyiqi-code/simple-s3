import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Daftar ekstensi gambar yang didukung untuk optimasi
 */
const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'gif'];

/**
 * Mengecek apakah suatu file merupakan gambar berdasarkan ekstensinya
 * 
 * @param ext Ekstensi file (tanpa titik, huruf kecil)
 * @returns true jika didukung, false jika tidak
 */
export function isImageFile(ext: string): boolean {
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext.toLowerCase());
}

/**
 * Mengoptimalkan file gambar dengan mengonversinya ke format WebP dan melakukan kompresi
 * 
 * @param inputPath Path file gambar asli (temporary)
 * @param outputDirectory Direktori penyimpanan permanen
 * @param outputFileName Nama file baru (dengan ekstensi asli yang akan diganti ke .webp)
 * @returns Object berisi informasi file hasil optimasi (path, filename, size)
 */
export async function optimizeImageToWebP(
  inputPath: string,
  outputDirectory: string,
  outputFileName: string
): Promise<{ outputPath: string; filename: string; size: number }> {
  // Ganti ekstensi file menjadi .webp
  const ext = path.extname(outputFileName);
  const baseName = path.basename(outputFileName, ext);
  const webpFileName = `${baseName}.webp`;
  const outputPath = path.join(outputDirectory, webpFileName);

  // Jalankan pipeline Sharp untuk konversi ke webp dengan kualitas optimal (default: 80)
  // sharp.rotate() dipanggil untuk memastikan orientasi gambar otomatis diperbaiki berdasarkan metadata EXIF
  await sharp(inputPath)
    .rotate()
    .webp({ quality: 80, effort: 4 })
    .toFile(outputPath);

  // Ambil informasi ukuran file baru
  const stats = await fs.stat(outputPath);

  return {
    outputPath,
    filename: webpFileName,
    size: stats.size
  };
}
