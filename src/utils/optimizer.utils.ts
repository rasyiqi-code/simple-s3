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

  // Jalankan pipeline Sharp untuk optimasi:
  // 1. rotate() -> Otomatis memperbaiki rotasi berdasarkan sensor EXIF kamera
  // 2. resize() -> Turunkan resolusi secara otomatis ke lebar maksimal 1920px (tanpa memperbesar gambar kecil)
  // 3. stripMetadata (default Sharp membuang metadata) -> Membuang profil warna EXIF kamera yang tidak perlu untuk hemat ruang
  // 4. webp() -> Kompresi WebP kualitas 75 (optimal) dengan tingkat usaha (effort) 6 (kompresi paling padat)
  await sharp(inputPath)
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: 'inside',           // Jaga rasio aspek gambar tetap proporsional
      withoutEnlargement: true // Jangan memperbesar gambar jika resolusi aslinya lebih kecil dari 1920px
    })
    .webp({ 
      quality: 75,             // Standar emas industri: kualitas tajam namun ukuran file drop signifikan
      effort: 6,               // Usaha CPU maksimal untuk menghasilkan ukuran paling ringkas
      lossless: false          // Gunakan kompresi lossy agar file jauh lebih kecil
    })
    .toFile(outputPath);

  // Ambil informasi ukuran file baru
  const stats = await fs.stat(outputPath);

  return {
    outputPath,
    filename: webpFileName,
    size: stats.size
  };
}
