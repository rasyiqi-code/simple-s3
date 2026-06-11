import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import existsSync from 'fs';
import path from 'path';
import app from '../src/app.js';
import { config } from '../src/config/index.js';
import { db, runMigrations } from '../src/config/database.js';
let testServer;
let testPort;
let baseUrl;
// Definisikan API key test dan direktori upload test terpisah
const TEST_API_KEY = 'test-secret-key';
const TEST_UPLOAD_DIR = 'uploads_test';
beforeAll(async () => {
    // Override konfigurasi config untuk testing agar tidak mengganggu data asli
    config.apiKey = TEST_API_KEY;
    config.uploadDir = TEST_UPLOAD_DIR;
    // Jalankan migrasi database
    runMigrations();
    // Bersihkan tabel database uji agar terisolasi dan bersih
    db.run('DELETE FROM api_keys');
    db.run('DELETE FROM files');
    // Masukkan API key uji ke database agar middleware auth mengenalinya
    db.run('INSERT INTO api_keys (key_value, name, status, created_at) VALUES (?, ?, ?, ?)', [TEST_API_KEY, 'API Key Uji Coba', 'active', Date.now()]);
    // Pastikan folder bersih sebelum tes berjalan
    await fs.rm(config.getAbsoluteUploadDir(), { recursive: true, force: true });
    await fs.mkdir(config.getAbsoluteTempDir(), { recursive: true });
    // Cari port acak bebas untuk server tes
    testPort = 3000 + Math.floor(Math.random() * 1000);
    baseUrl = `http://localhost:${testPort}`;
    // Start Express server untuk testing
    testServer = app.listen(testPort);
});
afterAll(async () => {
    // Tutup server setelah semua tes selesai
    if (testServer) {
        testServer.close();
    }
    // Hapus folder upload test agar lingkungan kembali bersih
    await fs.rm(config.getAbsoluteUploadDir(), { recursive: true, force: true });
});
describe('Internal Storage API Service Tests', () => {
    // 1. Pengujian Endpoint Tidak Ditemukan
    it('harus mengembalikan 404 ketika rute tidak ditemukan', async () => {
        const response = await fetch(`${baseUrl}/api/unknown-route`);
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.error).toBe('Rute API tidak ditemukan');
    });
    // 2. Pengujian Autentikasi API Key
    it('harus menolak request upload jika x-api-key tidak disertakan', async () => {
        const response = await fetch(`${baseUrl}/api/upload`, {
            method: 'POST'
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('API Key tidak ditemukan');
    });
    it('harus menolak request upload jika x-api-key tidak valid', async () => {
        const response = await fetch(`${baseUrl}/api/upload`, {
            method: 'POST',
            headers: {
                'x-api-key': 'key-yang-salah'
            }
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('API Key tidak valid');
    });
    // 3. Pengujian Validasi Multipart Form Data
    it('harus menolak upload jika payload tidak menyertakan field "file"', async () => {
        const formData = new FormData();
        formData.append('bukan_file', 'data_biasa');
        const response = await fetch(`${baseUrl}/api/upload`, {
            method: 'POST',
            headers: {
                'x-api-key': TEST_API_KEY
            },
            body: formData
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('Harap lampirkan berkas');
    });
    // 4. Pengujian Upload File Non-Gambar (PDF)
    it('harus berhasil mengunggah file non-gambar (seperti PDF) dan menyimpannya langsung', async () => {
        const formData = new FormData();
        const pdfContent = 'Dummy PDF Content';
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        formData.append('file', blob, 'dokumen_test.pdf');
        const response = await fetch(`${baseUrl}/api/upload`, {
            method: 'POST',
            headers: {
                'x-api-key': TEST_API_KEY
            },
            body: formData
        });
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.originalName).toBe('dokumen_test.pdf');
        expect(body.data.mimeType).toBe('application/pdf');
        expect(body.data.url).toContain('/file/');
        // Periksa apakah file fisik benar-benar tersimpan di folder upload
        const savedFileName = body.data.filename;
        const physicalPath = path.join(config.getAbsoluteUploadDir(), savedFileName);
        expect(existsSync.existsSync(physicalPath)).toBe(true);
        // Cek isi file apakah sesuai
        const fileContent = await fs.readFile(physicalPath, 'utf-8');
        expect(fileContent).toBe(pdfContent);
    });
    // 5. Pengujian Upload File Gambar & Optimasi ke WebP
    it('harus mengonversi gambar PNG menjadi format WebP dan mengompresinya secara otomatis', async () => {
        const formData = new FormData();
        // PNG 1x1 transparan piksel minimalis dalam bentuk base64
        const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        const buffer = Buffer.from(pngBase64, 'base64');
        const blob = new Blob([buffer], { type: 'image/png' });
        formData.append('file', blob, 'foto_profile.png');
        const response = await fetch(`${baseUrl}/api/upload`, {
            method: 'POST',
            headers: {
                'x-api-key': TEST_API_KEY
            },
            body: formData
        });
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.originalName).toBe('foto_profile.png');
        // MimeType harus menjadi image/webp karena dikonversi otomatis
        expect(body.data.mimeType).toBe('image/webp');
        expect(body.data.filename).toContain('.webp');
        expect(body.data.filename).not.toContain('.png');
        // Periksa apakah file fisik .webp hasil kompresi tersimpan
        const savedFileName = body.data.filename;
        const physicalPath = path.join(config.getAbsoluteUploadDir(), savedFileName);
        expect(existsSync.existsSync(physicalPath)).toBe(true);
        // Pastikan file temporary asli di folder temp sudah dibersihkan
        const tempFiles = await fs.readdir(config.getAbsoluteTempDir());
        expect(tempFiles.length).toBe(0);
    });
    // 6. Pengujian Download File (Serving Static Files)
    it('harus menyajikan berkas statis publik dengan Cache-Control header yang tepat', async () => {
        // 1. Upload dulu file dokumen
        const formData = new FormData();
        formData.append('file', new Blob(['Static Serving Test'], { type: 'application/pdf' }), 'test_file.pdf');
        const uploadResponse = await fetch(`${baseUrl}/api/upload`, {
            method: 'POST',
            headers: {
                'x-api-key': TEST_API_KEY
            },
            body: formData
        });
        const uploadBody = await uploadResponse.json();
        const generatedFilename = uploadBody.data.filename;
        // 2. Akses file yang diupload via endpoint publik
        const getResponse = await fetch(`${baseUrl}/file/${generatedFilename}`);
        expect(getResponse.status).toBe(200);
        // Periksa Header Cache-Control
        const cacheHeader = getResponse.headers.get('Cache-Control');
        expect(cacheHeader).toBe('public, max-age=31536000, immutable');
        const content = await getResponse.text();
        expect(content).toBe('Static Serving Test');
    });
    it('harus menolak request file jika mengandung pola Path Traversal', async () => {
        const response = await fetch(`${baseUrl}/file/..%2fpackage.json`);
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('tidak aman');
    });
    it('harus mengembalikan 404 jika file tidak ditemukan', async () => {
        const response = await fetch(`${baseUrl}/file/file-yang-tidak-pernah-ada.pdf`);
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('tidak ditemukan');
    });
    // --- SEKSI TEST BARU: API ADMIN & DATABASE SQLITE ---
    describe('Admin Dashboard API Tests (Fase 2)', () => {
        it('harus memverifikasi login admin dengan master key yang benar', async () => {
            const response = await fetch(`${baseUrl}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ masterKey: TEST_API_KEY })
            });
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });
        it('harus menolak login admin dengan master key yang salah', async () => {
            const response = await fetch(`${baseUrl}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ masterKey: 'wrong-key' })
            });
            expect(response.status).toBe(401);
        });
        it('harus menolak akses rute admin jika tidak membawa header x-admin-key', async () => {
            const response = await fetch(`${baseUrl}/api/admin/keys`);
            expect(response.status).toBe(401);
        });
        it('harus mampu membuat API key dinamis baru, menggunakannya untuk upload, lalu menghapusnya', async () => {
            // 1. Buat API key dinamis baru
            const createResponse = await fetch(`${baseUrl}/api/admin/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': TEST_API_KEY
                },
                body: JSON.stringify({ name: 'Key Test Integrasi' })
            });
            expect(createResponse.status).toBe(201);
            const createBody = await createResponse.json();
            expect(createBody.success).toBe(true);
            const newKey = createBody.data.keyValue;
            expect(newKey).toContain('sk_');
            // 2. Cek apakah key baru masuk dalam list
            const listResponse = await fetch(`${baseUrl}/api/admin/keys`, {
                headers: { 'x-admin-key': TEST_API_KEY }
            });
            const listBody = await listResponse.json();
            expect(listBody.data.some((k) => k.key_value === newKey)).toBe(true);
            // 3. Gunakan key baru untuk mengupload berkas PDF dummy
            const formData = new FormData();
            formData.append('file', new Blob(['Dynamic Key Upload Test'], { type: 'application/pdf' }), 'dynamic_test.pdf');
            const uploadResponse = await fetch(`${baseUrl}/api/upload`, {
                method: 'POST',
                headers: { 'x-api-key': newKey },
                body: formData
            });
            expect(uploadResponse.status).toBe(201);
            const uploadBody = await uploadResponse.json();
            const generatedFilename = uploadBody.data.filename;
            // 4. Cek apakah berkas tercatat di list files admin
            const filesResponse = await fetch(`${baseUrl}/api/admin/files`, {
                headers: { 'x-admin-key': TEST_API_KEY }
            });
            const filesBody = await filesResponse.json();
            expect(filesBody.data.some((f) => f.filename === generatedFilename)).toBe(true);
            // 5. Hapus berkas tersebut via admin file manager
            const deleteFileResponse = await fetch(`${baseUrl}/api/admin/files/${generatedFilename}`, {
                method: 'DELETE',
                headers: { 'x-admin-key': TEST_API_KEY }
            });
            expect(deleteFileResponse.status).toBe(200);
            // 6. Hapus API key dinamis tersebut
            const keyRecord = listBody.data.find((k) => k.key_value === newKey);
            const deleteKeyResponse = await fetch(`${baseUrl}/api/admin/keys/${keyRecord.id}`, {
                method: 'DELETE',
                headers: { 'x-admin-key': TEST_API_KEY }
            });
            expect(deleteKeyResponse.status).toBe(200);
        });
        it('harus mampu mengunggah banyak berkas sekaligus secara paralel dan mengonversi gambar jika ada', async () => {
            const formData = new FormData();
            // File 1: Teks PDF dummy
            formData.append('files', new Blob(['File 1 Content'], { type: 'application/pdf' }), 'multiple_1.pdf');
            // File 2: Gambar PNG dummy 1x1 base64
            const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
            const buffer = Buffer.from(pngBase64, 'base64');
            formData.append('files', new Blob([buffer], { type: 'image/png' }), 'multiple_2.png');
            const response = await fetch(`${baseUrl}/api/upload/multiple`, {
                method: 'POST',
                headers: { 'x-api-key': TEST_API_KEY },
                body: formData
            });
            expect(response.status).toBe(201);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.data.length).toBe(2);
            // Verifikasi file 1 (.pdf)
            const file1 = body.data.find((f) => f.originalName === 'multiple_1.pdf');
            expect(file1).toBeDefined();
            expect(file1.mimeType).toBe('application/pdf');
            // Verifikasi file 2 (.png teroptimasi ke .webp)
            const file2 = body.data.find((f) => f.originalName === 'multiple_2.png');
            expect(file2).toBeDefined();
            expect(file2.mimeType).toBe('image/webp');
            expect(file2.filename).toContain('.webp');
            // Bersihkan file test fisik
            await fs.unlink(path.join(config.getAbsoluteUploadDir(), file1.filename)).catch(() => { });
            await fs.unlink(path.join(config.getAbsoluteUploadDir(), file2.filename)).catch(() => { });
        });
        it('harus mampu menghapus berkas oleh klien menggunakan API Key klien yang valid', async () => {
            // 1. Upload dulu file dokumen
            const formData = new FormData();
            formData.append('file', new Blob(['Client Delete Test'], { type: 'application/pdf' }), 'client_del.pdf');
            const uploadResponse = await fetch(`${baseUrl}/api/upload`, {
                method: 'POST',
                headers: { 'x-api-key': TEST_API_KEY },
                body: formData
            });
            const uploadBody = await uploadResponse.json();
            const generatedFilename = uploadBody.data.filename;
            // 2. Kirim request delete oleh klien
            const deleteResponse = await fetch(`${baseUrl}/api/file/${generatedFilename}`, {
                method: 'DELETE',
                headers: { 'x-api-key': TEST_API_KEY }
            });
            expect(deleteResponse.status).toBe(200);
            const deleteBody = await deleteResponse.json();
            expect(deleteBody.success).toBe(true);
            // Cek apakah file fisik terhapus
            const filePath = path.join(config.getAbsoluteUploadDir(), generatedFilename);
            expect(existsSync.existsSync(filePath)).toBe(false);
        });
        it('harus mencatat seluruh aktivitas audit log di database SQLite dan dapat diakses oleh admin', async () => {
            const response = await fetch(`${baseUrl}/api/admin/logs`, {
                headers: { 'x-admin-key': TEST_API_KEY }
            });
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
            // Harus ada log tercatat (minimal aksi UPLOAD_SINGLE dan DELETE_FILE dari tes di atas)
            expect(body.data.length).toBeGreaterThan(0);
            expect(body.data.some((l) => l.action === 'UPLOAD_SINGLE')).toBe(true);
            expect(body.data.some((l) => l.action === 'DELETE_FILE')).toBe(true);
        });
    });
});
