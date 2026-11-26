import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Menentukan apakah DATABASE_URL mengarah ke Neon sehingga SSL harus diaktifkan.
 */
const databaseUrl = process.env.DATABASE_URL || '';
const isNeon = databaseUrl.includes('neon.tech') || databaseUrl.includes('neon.database');
const isProduction = process.env.NODE_ENV === 'production';
const useSSL =
  process.env.DB_SSL === 'true' ||
  databaseUrl.includes('sslmode=require') ||
  isNeon ||
  isProduction;

async function runMigration() {
  let pool;

  if (databaseUrl) {
    console.log('🔗 Menggunakan DATABASE_URL (Neon / cloud)...');
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: 2,
      connectionTimeoutMillis: 10000,
    });
  } else {
    console.log('🔗 Menggunakan konfigurasi host lokal...');
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'capstone_project',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });
  }

  const client = await pool.connect();

  try {
    const dbId = databaseUrl
      ? databaseUrl.replace(/:[^:@]+@/, ':***@') // sembunyikan password di log
      : `${process.env.DB_HOST || 'localhost'}/${process.env.DB_NAME || 'capstone_project'}`;

    console.log(`⏳ Menghubungkan ke database: ${dbId}...`);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const seedPath = path.join(__dirname, 'seed.sql');

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('⏳ Menjalankan schema.sql (membuat 16 tabel & relasi FK)...');
    await client.query(schemaSql);
    console.log('✅ 16 tabel berhasil dibuat!');

    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      console.log('⏳ Menjalankan seed.sql (mengisi data master awal)...');
      await client.query(seedSql);
      console.log('✅ Data master (roles, users, categories, shift_types, payment_methods) berhasil diisi!');
    }

    console.log('🎉 Migrasi database selesai dengan sukses!');
  } catch (error) {
    console.error('❌ Gagal menjalankan migrasi:', error.message);

    if (error.code === '28P01') {
      console.error('💡 Tip: Password database salah. Cek DATABASE_URL atau DB_PASSWORD di env.');
    } else if (error.code === '3D000') {
      console.error('💡 Tip: Database belum ada. Buat database terlebih dahulu di dashboard Neon/PostgreSQL.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Tip: Koneksi ditolak. Pastikan DATABASE_URL atau host/port database sudah benar.');
    } else if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.message?.includes('ssl')) {
      console.error('💡 Tip: Masalah SSL. Pastikan DATABASE_URL mengandung ?sslmode=require untuk Neon.');
    }

    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
