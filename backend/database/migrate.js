import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'capstone_project',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  const client = await pool.connect();

  try {
    console.log(` Menghubungkan ke database PostgreSQL: "${process.env.DB_NAME || 'capstone_project'}"...`);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const seedPath = path.join(__dirname, 'seed.sql');

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('⏳ Menjalankan schema.sql (membuat 16 tabel & relasi FK)...');
    await client.query(schemaSql);
    console.log(' 16 tabel berhasil dibuat!');

    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      console.log('⏳ Menjalankan seed.sql (mengisi data master awal)...');
      await client.query(seedSql);
      console.log(' Data master (roles, users, categories, shift_types, payment_methods) berhasil diisi!');
    }

    console.log('🎉 Migrasi database selesai dengan sukses!');
  } catch (error) {
    console.error(' Gagal menjalankan migrasi:', error.message);
    if (error.code === '28P01') {
      console.error(' Tip: Password database salah. Sesuaikan DB_PASSWORD di file .env');
    } else if (error.code === '3D000') {
      console.error(' Tip: Database belum ada. Pastikan database capstone_project sudah dibuat di PostgreSQL.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
