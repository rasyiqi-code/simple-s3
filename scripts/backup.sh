#!/bin/bash

# ==============================================================================
# Script Backup Otomatis - Internal Storage Service (simple-s3)
# Mengompresi folder uploads/ dan database SQLite lokal data/storage.db
# ==============================================================================

# 1. KONFIGURASI PATH
APP_DIR="/media/rasyiqi/PROJECT/simple-s3" # Ganti dengan path absolut instalasi di VPS jika berbeda
RETENTION_DAYS=30                          # Jumlah hari cadangan disimpan sebelum dihapus

# Membaca variabel environment dari file .env jika ada
if [ -f "${APP_DIR}/.env" ]; then
    echo "[INFO] Membaca konfigurasi dari file .env..."
    # Ambil nilai dari .env tapi abaikan baris komentar atau baris kosong
    export $(grep -v '^#' "${APP_DIR}/.env" | xargs)
fi

# Tentukan direktori backup (default ke /var/backups/simple-s3 jika tidak diset)
BACKUP_DIR=${BACKUP_DIR:-/var/backups/simple-s3}

# Tentukan direktori database dan uploads (default ke 'data' dan 'uploads' jika tidak diset)
DB_DIR=${DATABASE_DIR:-data}
UP_DIR=${UPLOAD_DIR:-uploads}

# Tentukan path absolut untuk database dan uploads
if [[ "$DB_DIR" = /* ]]; then
    ABS_DB_DIR="$DB_DIR"
else
    ABS_DB_DIR="${APP_DIR}/${DB_DIR}"
fi

if [[ "$UP_DIR" = /* ]]; then
    ABS_UP_DIR="$UP_DIR"
else
    ABS_UP_DIR="${APP_DIR}/${UP_DIR}"
fi

DB_FILE="${ABS_DB_DIR}/storage.db"

# Format tanggal untuk nama file
DATE=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/storage-backup-${DATE}.tar.gz"

echo "[INFO] Memulai pencadangan data pada $(date)..."

# 2. VALIDASI DIREKTORI
if [ ! -d "${BACKUP_DIR}" ]; then
    echo "[INFO] Direktori backup tidak ditemukan. Membuat direktori baru di ${BACKUP_DIR}..."
    mkdir -p "${BACKUP_DIR}"
fi

# 3. PROSES PENCADANGAN (TAR COMPRESSED)
# Melakukan backup pada folder uploads dan database SQLite storage.db
if [ -d "${ABS_UP_DIR}" ] && [ -f "${DB_FILE}" ]; then
    # Membuat temporary directory untuk menampung data yang akan dibackup agar struktur tar bersih
    TEMP_BACKUP_DIR=$(mktemp -d)
    mkdir -p "${TEMP_BACKUP_DIR}/uploads"
    mkdir -p "${TEMP_BACKUP_DIR}/data"
    
    # Salin data ke temp directory
    cp -r "${ABS_UP_DIR}/." "${TEMP_BACKUP_DIR}/uploads/"
    cp "${DB_FILE}" "${TEMP_BACKUP_DIR}/data/storage.db"
    
    # Lakukan kompresi tar
    tar -czf "${BACKUP_FILE}" -C "${TEMP_BACKUP_DIR}" uploads data
    
    # Bersihkan temp directory
    rm -rf "${TEMP_BACKUP_DIR}"
    
    if [ $? -eq 0 ]; then
        echo "[SUCCESS] Pencadangan selesai dengan sukses: ${BACKUP_FILE}"
        echo "[SUCCESS] Ukuran berkas cadangan: $(du -sh "${BACKUP_FILE}" | cut -f1)"
    else
        echo "[ERROR] Terjadi kesalahan saat mengompresi data."
        exit 1
    fi
else
    echo "[ERROR] Direktori uploads (${ABS_UP_DIR}) atau database (${DB_FILE}) tidak ditemukan."
    exit 1
fi

# 4. ROTASI BACKUP (MENGHAPUS CADANGAN LAMA)
# Mencari dan menghapus berkas backup lama yang berumur lebih dari RETENTION_DAYS
echo "[INFO] Memeriksa berkas cadangan lama (lebih dari ${RETENTION_DAYS} hari)..."
find "${BACKUP_DIR}" -name "storage-backup-*.tar.gz" -type f -mtime +${RETENTION_DAYS} -exec rm -f {} \;

if [ $? -eq 0 ]; then
    echo "[SUCCESS] Pembersihan cadangan lama selesai."
else
    echo "[WARNING] Gagal membersihkan cadangan lama."
fi

echo "[INFO] Selesai."
