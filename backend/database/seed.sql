-- =====================================================================
-- SEED DATA AWAL ESBE CASH RECAP (PostgreSQL)
-- Database: capstone_project
-- =====================================================================

-- 1. Master Roles
INSERT INTO roles (role_name) VALUES
    ('owner'),
    ('employee')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Master Pengguna Awal (Password di-hash dengan bcrypt cost 10)
-- Akun uji:
--   owner    / owner123     (role: owner, aktif)
--   employee / employee123  (role: employee, aktif)
--   nonaktif / nonaktif123  (role: employee, non-aktif)

INSERT INTO users (role_id, fullname, username, password, is_active) VALUES
    ((SELECT role_id FROM roles WHERE role_name = 'owner'), 'Umar Syafie', 'owner', '$2b$10$z/SjF4MZPCPv0I.9G.OgZuLNjdli5Te4TPrAnOiKuWmFr7DBMe3l2', TRUE),
    ((SELECT role_id FROM roles WHERE role_name = 'employee'), 'Karyawan Kasir', 'employee', '$2b$10$uQqD39m9Db9hKkeU1tIEG.McuHQD9Bt6kG3IW25MPntkyBhS70ELi', TRUE),
    ((SELECT role_id FROM roles WHERE role_name = 'employee'), 'Karyawan Non-Aktif', 'nonaktif', '$2b$10$JIl3o91SDqVkBCoSKITnW.MjoBDia1eqIbIG1BfShB9LIr/Dtgrbi', FALSE)
ON CONFLICT (username) DO UPDATE SET
    role_id = EXCLUDED.role_id,
    fullname = EXCLUDED.fullname,
    password = EXCLUDED.password,
    is_active = EXCLUDED.is_active;

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
