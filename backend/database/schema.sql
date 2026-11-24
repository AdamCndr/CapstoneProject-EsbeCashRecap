-- =====================================================================
-- SCHEMA DATABASE ESBE CASH RECAP (PostgreSQL)
-- Database: capstone_project
-- Sesuai dengan ERD Arsitektur Backend & Telegram Integration
-- =====================================================================

-- Hapus tabel lama jika ada (urutan penghapusan mematuhi relasi foreign key)
DROP TABLE IF EXISTS telegram_bot_sessions CASCADE;
DROP TABLE IF EXISTS telegram_outbox CASCADE;
DROP TABLE IF EXISTS transaction_audit_logs CASCADE;
DROP TABLE IF EXISTS duplicate_checks CASCADE;
DROP TABLE IF EXISTS transaction CASCADE;
DROP TABLE IF EXISTS ocr_extractions CASCADE;
DROP TABLE IF EXISTS payment_proofs CASCADE;
DROP TABLE IF EXISTS telegram_inbox CASCADE;
DROP TABLE IF EXISTS telegram_link_tokens CASCADE;
DROP TABLE IF EXISTS telegram_accounts CASCADE;
DROP TABLE IF EXISTS work_shifts CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS shift_types CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ---------------------------------------------------------------------
-- 1. TABEL ROLES (Hak Akses Pengguna: Admin, Operator)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- 2. TABEL USERS (Pengguna Sistem: Admin & Kasir Toko)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    role_id INT NOT NULL REFERENCES roles(role_id) ON UPDATE CASCADE,
    fullname VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    create_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 3. TABEL SHIFT_TYPES (Jenis Shift Kerja: Pagi, Siang)
-- ---------------------------------------------------------------------
CREATE TABLE shift_types (
    shift_type_id SERIAL PRIMARY KEY,
    shift_name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

-- ---------------------------------------------------------------------
-- 4. TABEL PAYMENT_METHODS (Metode Pembayaran: Tunai, QRIS, Transfer)
-- ---------------------------------------------------------------------
CREATE TABLE payment_methods (
    payment_method_id SERIAL PRIMARY KEY,
    method_code VARCHAR(50) NOT NULL UNIQUE,
    method_name VARCHAR(100) NOT NULL
);

-- ---------------------------------------------------------------------
-- 5. TABEL CATEGORIES (Kategori Layanan & Pengeluaran Kasir)
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- 6. TABEL WORK_SHIFTS (Sesi Shift Harian Buka / Tutup Kas)
-- ---------------------------------------------------------------------
CREATE TABLE work_shifts (
    work_shift_id SERIAL PRIMARY KEY,
    shift_type_id INT NOT NULL REFERENCES shift_types(shift_type_id) ON UPDATE CASCADE,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opened_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    closed_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
);

-- ---------------------------------------------------------------------
-- 7. TABEL TELEGRAM_ACCOUNTS (Akun Telegram Kasir yang Terhubung)
-- ---------------------------------------------------------------------
CREATE TABLE telegram_accounts (
    telegram_account_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    telegram_user_id BIGINT NOT NULL UNIQUE,
    telegram_chat_id BIGINT NOT NULL,
    telegram_username VARCHAR(100),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    linked_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);

-- ---------------------------------------------------------------------
-- 8. TABEL TELEGRAM_LINK_TOKENS (Token Pairing Akun Web & Bot Telegram)
-- ---------------------------------------------------------------------
CREATE TABLE telegram_link_tokens (
    link_token_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 9. TABEL TELEGRAM_INBOX (Pesan / Foto Masuk dari Bot Telegram)
-- ---------------------------------------------------------------------
CREATE TABLE telegram_inbox (
    inbox_id SERIAL PRIMARY KEY,
    telegram_account_id INT REFERENCES telegram_accounts(telegram_account_id) ON DELETE SET NULL,
    update_id BIGINT,
    message_id BIGINT,
    file_id VARCHAR(255),
    file_unique_id VARCHAR(255),
    media_type VARCHAR(50),
    file_size BIGINT,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'pending'
);

-- ---------------------------------------------------------------------
-- 10. TABEL PAYMENT_PROOFS (File Bukti Pembayaran / Struk Kasir)
-- ---------------------------------------------------------------------
CREATE TABLE payment_proofs (
    proof_id SERIAL PRIMARY KEY,
    inbox_id INT REFERENCES telegram_inbox(inbox_id) ON DELETE SET NULL,
    submitted_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'upload', -- 'upload' atau 'telegram'
    storage_key VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255),
    mime_type VARCHAR(100),
    file_size BIGINT,
    sha256_hash VARCHAR(64),
    proof_status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 11. TABEL OCR_EXTRACTIONS (Hasil Ekstraksi OCR Otomatis dari Bukti)
-- ---------------------------------------------------------------------
CREATE TABLE ocr_extractions (
    extraction_id SERIAL PRIMARY KEY,
    proof_id INT NOT NULL REFERENCES payment_proofs(proof_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'tesseract',
    extracted_amount NUMERIC(15, 2),
    transaction_reference VARCHAR(100),
    confidence_amount NUMERIC(5, 2),
    confidence_time NUMERIC(5, 2),
    extraction_status VARCHAR(50) NOT NULL DEFAULT 'success',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 12. TABEL TRANSACTION (Transaksi Kasir: Pemasukan & Pengeluaran)
-- ---------------------------------------------------------------------
CREATE TABLE transaction (
    transaction_id SERIAL PRIMARY KEY,
    work_shift_id INT REFERENCES work_shifts(work_shift_id) ON DELETE SET NULL,
    shift_type_id INT REFERENCES shift_types(shift_type_id) ON DELETE SET NULL,
    payment_method_id INT REFERENCES payment_methods(payment_method_id) ON DELETE SET NULL,
    payment_proof_id INT REFERENCES payment_proofs(proof_id) ON DELETE SET NULL,
    category_id INT REFERENCES categories(category_id) ON DELETE SET NULL,
    created_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    confirmed_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('pemasukan', 'pengeluaran')),
    amount NUMERIC(15, 2) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_time TIME NOT NULL DEFAULT CURRENT_TIME,
    transaction_status VARCHAR(50) NOT NULL DEFAULT 'completed',
    notes TEXT,
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 13. TABEL DUPLICATE_CHECKS (Pengecekan Transaksi / Bukti Ganda)
-- ---------------------------------------------------------------------
CREATE TABLE duplicate_checks (
    duplicate_check_id SERIAL PRIMARY KEY,
    proof_id INT REFERENCES payment_proofs(proof_id) ON DELETE CASCADE,
    matched_transaction_id INT REFERENCES transaction(transaction_id) ON DELETE SET NULL,
    match_method VARCHAR(50),
    similarity_score NUMERIC(5, 2),
    review_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    review_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 14. TABEL TRANSACTION_AUDIT_LOGS (Log Riwayat Perubahan Transaksi)
-- ---------------------------------------------------------------------
CREATE TABLE transaction_audit_logs (
    audit_id SERIAL PRIMARY KEY,
    transaction_id INT NOT NULL REFERENCES transaction(transaction_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 15. TABEL TELEGRAM_OUTBOX (Antrean Pesan Keluar dari Bot ke Kasir)
-- ---------------------------------------------------------------------
CREATE TABLE telegram_outbox (
    outbox_id SERIAL PRIMARY KEY,
    telegram_account_id INT NOT NULL REFERENCES telegram_accounts(telegram_account_id) ON DELETE CASCADE,
    inbox_id INT REFERENCES telegram_inbox(inbox_id) ON DELETE SET NULL,
    transaction_id INT REFERENCES transaction(transaction_id) ON DELETE SET NULL,
    message_type VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    send_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    telegram_message_id BIGINT,
    send_at TIMESTAMP,
    create_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 16. TABEL TELEGRAM_BOT_SESSIONS (State Machine Percakapan Bot Kasir)
-- ---------------------------------------------------------------------
CREATE TABLE telegram_bot_sessions (
    session_id SERIAL PRIMARY KEY,
    telegram_account_id INT NOT NULL REFERENCES telegram_accounts(telegram_account_id) ON DELETE CASCADE,
    current_step VARCHAR(50) NOT NULL DEFAULT 'idle',
    pending_inbox_id INT REFERENCES telegram_inbox(inbox_id) ON DELETE SET NULL,
    pending_proof_id INT REFERENCES payment_proofs(proof_id) ON DELETE SET NULL,
    pending_ocr_data JSONB,
    create_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- ---------------------------------------------------------------------
-- INDEXES UNTUK PERFORMA QUERY CEPAT DI BACKEND
-- ---------------------------------------------------------------------
CREATE INDEX idx_transaction_date ON transaction(transaction_date);
CREATE INDEX idx_transaction_type ON transaction(transaction_type);
CREATE INDEX idx_transaction_shift ON transaction(shift_type_id);
CREATE INDEX idx_transaction_method ON transaction(payment_method_id);
CREATE INDEX idx_payment_proofs_hash ON payment_proofs(sha256_hash);
CREATE INDEX idx_telegram_accounts_user_id ON telegram_accounts(user_id);
CREATE INDEX idx_telegram_bot_sessions_account ON telegram_bot_sessions(telegram_account_id);
