import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config/index.js';
// Dapatkan path berkas database SQLite (.db) dari konfigurasi
const dbPath = config.getDatabasePath();
if (!fs.existsSync(dbPath)) {
    console.error(`[ERROR] Database tidak ditemukan di: ${dbPath}`);
    console.error(`Silakan jalankan aplikasi terlebih dahulu dengan 'bun run dev' atau 'npm run dev' agar database terinisialisasi.`);
    process.exit(1);
}
const db = new DatabaseSync(dbPath);
function showKeys() {
    console.log('\n================================================================');
    console.log('🔑  INFORMASI API KEY SIMPLE-S3  🔑');
    console.log('================================================================');
    // 1. Baca Master Key dari database
    try {
        const masterQuery = db.prepare("SELECT value FROM system_config WHERE key = 'master_key'");
        const masterRecord = masterQuery.get();
        if (masterRecord) {
            console.log(`\n👑  [Master API Key (di database)]`);
            console.log(`👉  ${masterRecord.value}`);
            console.log(`ℹ️   Digunakan untuk akses administratif / masuk ke Dasbor Admin.`);
        }
        else {
            console.log('\n⚠️   Master API Key tidak ditemukan di tabel system_config.');
        }
    }
    catch (err) {
        console.error('❌  Gagal membaca Master Key dari database:', err.message);
    }
    // 2. Baca Client API Keys
    try {
        const clientQuery = db.prepare("SELECT key_value, name, status, bucket_name FROM api_keys");
        const clientRecords = clientQuery.all();
        console.log(`\n👥  [Client API Keys (${clientRecords.length} terdaftar)]`);
        if (clientRecords.length > 0) {
            clientRecords.forEach((record, index) => {
                console.log(`${index + 1}. [${record.status.toUpperCase()}] ${record.name}`);
                console.log(`   Key   : ${record.key_value}`);
                console.log(`   Bucket: ${record.bucket_name || 'default'}`);
            });
        }
        else {
            console.log('ℹ️   Belum ada Client API Key yang dibuat.');
        }
    }
    catch (err) {
        console.error('❌  Gagal membaca Client API Keys dari database:', err.message);
    }
    console.log('\n💡  Tip: Jika ingin meng-override Master Key tanpa menyentuh database,');
    console.log('    silakan set variabel API_KEY di file .env Anda.');
    console.log('================================================================\n');
}
function resetMasterKey() {
    const newMasterKey = `sk_master_${crypto.randomBytes(16).toString('hex')}`;
    try {
        // Pastikan tabel config ada
        db.exec(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL
      )
    `);
        // Update atau Insert key baru
        const checkStmt = db.prepare("SELECT key FROM system_config WHERE key = 'master_key'");
        const exists = checkStmt.get();
        if (exists) {
            const updateStmt = db.prepare("UPDATE system_config SET value = ? WHERE key = 'master_key'");
            updateStmt.run(newMasterKey);
        }
        else {
            const insertStmt = db.prepare("INSERT INTO system_config (key, value) VALUES ('master_key', ?)");
            insertStmt.run(newMasterKey);
        }
        console.log('\n================================================================');
        console.log('🔄  MASTER API KEY BERHASIL DIRESET!  🔄');
        console.log('================================================================');
        console.log(`👉  Master API Key baru Anda:`);
        console.log(`    ${newMasterKey}`);
        console.log(`\nSilakan simpan key baru ini untuk login ke Dasbor Admin.`);
        console.log('================================================================\n');
    }
    catch (err) {
        console.error('❌  Gagal mereset Master API Key di database:', err.message);
        process.exit(1);
    }
}
// Parsing argument sederhana
const args = process.argv.slice(2);
if (args.includes('--reset')) {
    resetMasterKey();
}
else {
    // Default action: show keys
    showKeys();
}
