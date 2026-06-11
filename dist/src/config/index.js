import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Cari file .env dengan memanjat ke atas dari folder file ini berada
function findProjectRoot(startDir) {
    let currentDir = startDir;
    while (currentDir !== path.dirname(currentDir)) { // Berhenti di root file system
        if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    return process.cwd(); // Fallback ke process.cwd jika package.json tidak ditemukan
}
const projectRoot = findProjectRoot(__dirname);
// Fungsi untuk men-generate API_KEY secara otomatis di file .env jika kosong
function ensureEnvApiKey() {
    const envPath = path.join(projectRoot, '.env');
    if (!fs.existsSync(envPath)) {
        return;
    }
    try {
        let envContent = fs.readFileSync(envPath, 'utf8');
        // Pola regex untuk mendeteksi API_KEY= (kosong atau hanya berisi whitespace/komentar)
        const apiKeyRegex = /^API_KEY=\s*$/m;
        if (apiKeyRegex.test(envContent) || !envContent.includes('API_KEY=')) {
            const generatedKey = `sk_master_${crypto.randomBytes(16).toString('hex')}`;
            if (envContent.includes('API_KEY=')) {
                envContent = envContent.replace(apiKeyRegex, `API_KEY=${generatedKey}`);
            }
            else {
                envContent += `\nAPI_KEY=${generatedKey}`;
            }
            fs.writeFileSync(envPath, envContent, 'utf8');
            process.env.API_KEY = generatedKey;
            console.log(`\n================================================================`);
            console.log(`[ENV CONFIG] API_KEY kosong terdeteksi di .env!`);
            console.log(`👉 Berhasil men-generate dan menyimpan Master API Key baru ke .env:`);
            console.log(`   ${generatedKey}`);
            console.log(`================================================================\n`);
        }
    }
    catch (error) {
        console.error('[ENV CONFIG WARNING] Gagal memperbarui API_KEY di .env:', error);
    }
}
// Jalankan pemeriksaan otomatis sebelum memuat dotenv
ensureEnvApiKey();
// Memuat environment variables dari berkas .env lokal proyek jika ada
const localEnvPath = path.join(projectRoot, '.env');
if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
}
// Memuat environment variables dari berkas .env di luar proyek (parent directory) jika ada
// Ini memastikan file konfigurasi di luar folder deploy tidak ikut terhapus saat redeploy
const parentEnvPath = path.join(projectRoot, '..', '.env');
if (fs.existsSync(parentEnvPath)) {
    dotenv.config({ path: parentEnvPath, override: true });
}
// Buat API Key fallback acak yang aman jika tidak diset di .env
const fallbackApiKey = `sk_master_${crypto.randomBytes(16).toString('hex')}`;
// Konfigurasi direktori penyimpanan default
const defaultUploadDir = 'uploads';
export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiKey: process.env.API_KEY || fallbackApiKey,
    databaseDir: process.env.DATABASE_DIR || 'data',
    uploadDir: process.env.UPLOAD_DIR || defaultUploadDir,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // Default 50MB
    allowedExtensions: (process.env.ALLOWED_EXTENSIONS || 'jpg,jpeg,png,gif,webp,pdf,mp4,zip,docx,xlsx')
        .split(',')
        .map(ext => ext.trim().toLowerCase()),
    // Mendapatkan path absolut direktori upload
    getAbsoluteUploadDir() {
        return path.isAbsolute(this.uploadDir)
            ? this.uploadDir
            : path.join(projectRoot, this.uploadDir);
    },
    // Mendapatkan path absolut direktori database
    getAbsoluteDatabaseDir() {
        return path.isAbsolute(this.databaseDir)
            ? this.databaseDir
            : path.join(projectRoot, this.databaseDir);
    },
    // Mendapatkan path absolut berkas database SQLite (.db)
    getDatabasePath() {
        const isTestEnv = process.env.NODE_ENV === 'test' || globalThis.process?.env?.NODE_ENV === 'test';
        const dbName = isTestEnv ? 'storage_test.db' : 'storage.db';
        return path.join(this.getAbsoluteDatabaseDir(), dbName);
    },
    // Mendapatkan path absolut untuk direktori temporary upload
    getAbsoluteTempDir() {
        return path.join(this.getAbsoluteUploadDir(), 'temp');
    }
};
