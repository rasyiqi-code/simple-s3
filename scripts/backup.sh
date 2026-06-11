#!/bin/bash

# ==============================================================================
# Script Backup Otomatis - Internal Storage Service (simple-s3)
# Mengompresi folder uploads/ dan database SQLite lokal data/storage.db
# ==============================================================================

# 1. KONFIGURASI PATH
APP_DIR="/media/rasyiqi/PROJECT/simple-s3" # Ganti dengan path absolut instalasi di VPS jika berbeda
BACKUP_DIR="/var/backups/simple-s3"        # Direktori penyimpanan hasil cadangan
RETENTION_DAYS=30                          # Jumlah hari cadangan disimpan sebelum dihapus

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
# Melakukan backup pada folder uploads/ dan database SQLite data/storage.db
# Menggunakan opsi -C untuk memposisikan direktori asal agar hasil tar lebih rapi
if [ -d "${APP_DIR}/uploads" ] && [ -f "${APP_DIR}/data/storage.db" ]; then
    tar -czf "${BACKUP_FILE}" -C "${APP_DIR}" uploads data/storage.db
    
    if [ $? -eq 0 ]; then
        echo "[SUCCESS] Pencadangan selesai dengan sukses: ${BACKUP_FILE}"
        echo "[SUCCESS] Ukuran berkas cadangan: $(du -sh "${BACKUP_FILE}" | cut -f1)"
    else
        echo "[ERROR] Terjadi kesalahan saat mengompresi data."
        exit 1
    fi
else
    echo "[ERROR] Direktori uploads/ atau database storage.db tidak ditemukan di ${APP_DIR}."
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
