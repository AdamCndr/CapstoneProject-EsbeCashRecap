-- =====================================================================
-- SEED DATA AWAL ESBE CASH RECAP (PostgreSQL)
-- Database: capstone_project
-- =====================================================================

-- 1. Master Roles
INSERT INTO roles (role_name) VALUES
    ('admin'),
    ('operator')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Master Pengguna Awal (Password default: 'admin123' dan 'kasir123')
-- Catatan: Setelah bcrypt dipasang di backend, password ini bisa di-hash ulang.
INSERT INTO users (role_id, fullname, username, password, is_active) VALUES
    (1, 'Administrator', 'admin', '$2b$10$EP/7p0j0h/tKzVvC3wL2uec52Dk01a3WbE980sV7pXWqB3pGeqsUu', TRUE),
    (2, 'Kasir Toko Esbe', 'kasir', '$2b$10$EP/7p0j0h/tKzVvC3wL2uec52Dk01a3WbE980sV7pXWqB3pGeqsUu', TRUE)
ON CONFLICT (username) DO NOTHING;

-- 3. Master Jenis Shift
INSERT INTO shift_types (shift_name, start_time, end_time) VALUES
    ('pagi', '06:00:00', '14:00:00'),
    ('siang', '14:00:00', '22:00:00')
ON CONFLICT DO NOTHING;

-- 4. Master Metode Pembayaran
INSERT INTO payment_methods (method_code, method_name) VALUES
    ('tunai', 'Tunai'),
    ('qris', 'QRIS Merchant'),
    ('transfer', 'Transfer Bank')
ON CONFLICT (method_code) DO NOTHING;

-- 5. Master Kategori Transaksi
INSERT INTO categories (name, is_active) VALUES
    ('Jasa Fotokopi', TRUE),
    ('Percetakan & ATK', TRUE),
    ('Perlengkapan', TRUE),
    ('Maintenance', TRUE),
    ('Lain-lain', TRUE)
ON CONFLICT (name) DO NOTHING;
