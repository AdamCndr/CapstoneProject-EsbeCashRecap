# Panduan Lengkap Deploy ke Vercel — Esbe Cash Recap

Panduan ini menjelaskan langkah demi langkah untuk men-deploy seluruh stack **Fotocopy Esbe Lampu Merah** menggunakan ekosistem **Vercel (Hobby / Gratis)**, **Neon PostgreSQL**, dan **Supabase Storage**.

---

## Arsitektur Production

| Komponen | Platform | Keterangan |
| :--- | :--- | :--- |
| **Frontend** | Vercel (Static / Vite) | Folder `frontend/` |
| **Backend API** | Vercel Serverless (Express / Node.js) | Folder `backend/` (`api/index.js` + `vercel.json`) |
| **Layanan AI** | Vercel Serverless | Project terpisah untuk OCR / ekstraksi LLM |
| **Database** | Neon PostgreSQL | Memakai *Pooled Connection String* (`-pooler`) |
| **Gambar Bukti** | Supabase Storage | Bucket `payment-proofs` |

> **Urutan Deploy yang Disarankan:**
> 1. **Neon PostgreSQL** (Database & Migrasi)
> 2. **Supabase Storage** (Bucket gambar)
> 3. **Layanan AI** di Vercel (untuk mendapatkan `AI_SERVICE_URL`)
> 4. **Backend Express** di Vercel (untuk mendapatkan `VITE_API_URL`)
> 5. **Frontend React/Vite** di Vercel
> 6. **Update `CORS_ORIGINS`** di Backend & Redeploy

---

## Tahap 1: Siapkan Database (Neon PostgreSQL)

1. Buka [console.neon.tech](https://console.neon.tech) dan buat project baru (pilih region terdekat, misal **Singapore / `ap-southeast-1`**).
2. Di dashboard Neon → **Connection Details**, pilih **Pooled connection** (URL mengandung `-pooler` dan `?sslmode=require`).
   - *Mengapa Pooled?* Pada arsitektur serverless Vercel, banyak *invocation* bisa berjalan bersamaan. Pooled connection mencegah kehabisan slot koneksi database.
3. Jalankan migrasi tabel dari komputer lokal Anda (karena Vercel tidak menjalankan `startCommand` seperti Render):
   ```powershell
   cd backend
   # Pastikan DATABASE_URL di backend/.env mengarah ke Neon
   npm run migrate
   ```
4. Jika perlu data awal (role, shift, metode bayar, akun owner default), jalankan `backend/database/seed.sql` melalui **Neon SQL Editor** atau `psql`.

---

## Tahap 2: Siapkan Storage Gambar (Supabase Storage)

1. Buka [supabase.com](https://supabase.com) dan buat project baru (region **Singapore**).
2. Masuk ke menu **Storage** → **New bucket** → beri nama `payment-proofs`.
3. Masuk ke **Project Settings → API** dan catat:
   - `SUPABASE_URL` (Project URL)
   - `SUPABASE_SERVICE_KEY` (`service_role` secret key — **jangan** gunakan di frontend!)

---

## Tahap 3: Deploy Layanan AI ke Vercel

1. Buat project baru di Vercel untuk repository/folder Layanan AI Anda.
2. Pastikan ukurannya memenuhi batas serverless Vercel Gratis (disarankan memakai **LLM Vision API** atau endpoint ringan daripada model OCR lokal berukuran besar karena batas bundle serverless Vercel).
3. Atur Environment Variables yang dibutuhkan Layanan AI (misal API Key LLM & `AI_SERVICE_API_KEY`).
4. Setelah deploy selesai, catat URL production-nya, misalnya:
   `https://esbe-ai.vercel.app`

---

## Tahap 4: Deploy Backend Express ke Vercel

Backend di repo ini sudah dikonfigurasi untuk Vercel melalui:
- `backend/api/index.js` (entrypoint serverless)
- `backend/vercel.json` (routing semua path ke `api/index.js`)

### Langkah Deploy Backend:
1. Buka [vercel.com/new](https://vercel.com/new) → **Import Git Repository** (pilih repo `CapstoneProject-EsbeCashRecap`).
2. Pada **Project Settings**:
   - **Project Name:** `esbe-cash-recap-backend` (bebas)
   - **Root Directory:** klik **Edit** → pilih **`backend`**
   - **Framework Preset:** `Other`
3. Buka bagian **Environment Variables** dan isi seluruh variabel berikut:

| Key | Contoh / Nilai | Keterangan |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Wajib `production` |
| `DATABASE_URL` | `postgres://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Gunakan URL **Pooled** dari Neon |
| `DB_SSL` | `true` | Wajib untuk Neon |
| `JWT_SECRET` | *(random string min. 32 karakter)* | Generate via `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRE_MINUTES` | `60` | Durasi token login |
| `CORS_ORIGINS` | `http://localhost:5173` | Sementara dulu; nanti ditambah URL Frontend Vercel |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `60000` | Window rate limit login (ms) |
| `LOGIN_RATE_LIMIT_MAX` | `10` | Maksimal percobaan login per window |
| `AI_SERVICE_URL` | `https://esbe-ai.vercel.app` | URL dari Tahap 3 (tanpa `/` di akhir) |
| `AI_SERVICE_TIMEOUT_MS` | `9000` | Disarankan ≤ 9000 ms untuk Vercel Hobby (timeout 10 detik) |
| `AI_SERVICE_API_KEY` | *(sama dengan di Layanan AI)* | API Key autentikasi ke Layanan AI |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Dari Tahap 2 |
| `SUPABASE_SERVICE_KEY` | `eyJhbGci...` | Service role key dari Tahap 2 |
| `SUPABASE_BUCKET` | `payment-proofs` | Nama bucket |

4. Klik **Deploy**.
5. Setelah berhasil, uji endpoint health check di browser:
   `https://<domain-backend-anda>.vercel.app/health`
   Pastikan respons JSON menunjukkan `"status": "ok"` dan `"database": "connected"`.

---

## Tahap 5: Deploy Frontend (Vite/React) ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new) → **Import Git Repository** yang **sama** (`CapstoneProject-EsbeCashRecap`).
2. Pada **Project Settings**:
   - **Project Name:** `esbe-cash-recap-frontend` (bebas)
   - **Root Directory:** klik **Edit** → pilih **`frontend`**
   - **Framework Preset:** `Vite` (otomatis terdeteksi)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Buka bagian **Environment Variables** dan isi:

| Key | Nilai | Keterangan |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://<domain-backend-anda>.vercel.app` | URL Backend dari Tahap 4 (**tanpa `/` di akhir**) |
| `VITE_USE_MOCK` | `false` | Pastikan tidak memakai mock data |

4. Klik **Deploy**.
5. Catat URL production frontend Anda, misalnya: `https://esbe-cash-recap-frontend.vercel.app`.

> **Catatan:** Semua variabel `VITE_*` disisipkan saat *build time*. Jika Anda mengubah `VITE_API_URL` di kemudian hari, Anda wajib melakukan **Redeploy** di project frontend agar perubahan terbaca.

---

## Tahap 6: Update `CORS_ORIGINS` di Backend & Redeploy

1. Kembali ke project **Backend** di Vercel Dashboard → **Settings → Environment Variables**.
2. Edit variabel `CORS_ORIGINS` dan masukkan domain production frontend (pisahkan dengan koma tanpa spasi jika lebih dari satu):
   ```
   https://esbe-cash-recap-frontend.vercel.app
   ```
3. Masuk ke tab **Deployments** di project Backend → klik ikon titik tiga (`...`) pada deployment terbaru → **Redeploy**.
4. Buka URL frontend di browser dan uji alur **Login → Input Transaksi → Dashboard/Rekap**.

---

## Hal Penting & Batasan Vercel Gratis (Hobby Plan)

1. **Batas Ukuran Upload 4.5 MB per Request**
   - Vercel Serverless Function menolak request body di atas **4.5 MB** (status `413`) sebelum masuk ke kode Express.
   - Pastikan foto bukti QRIS/transfer dari kamera HP dikompresi di frontend (ideal `< 1–2 MB`) sebelum dikirim ke `/transactions/extract`.
2. **Batas Timeout Eksekusi Serverless**
   - Paket Hobby memiliki batas eksekusi default **10 detik** per request (dapat diperpanjang jika *Fluid Compute* aktif di pengaturan project).
   - Pastikan Layanan AI merespons dengan cepat agar endpoint OCR tidak terkena `504 Gateway Timeout`.
3. **Rate Limiter In-Memory**
   - `backend/src/core/rateLimiter.js` menggunakan `Map` di memori. Pada arsitektur serverless, memori tiap instance terpisah sehingga pembatasan login bersifat *best-effort* per instance.
4. **Migrasi Database**
   - Setiap kali ada perubahan skema SQL di `backend/database/`, jalankan `npm run migrate` dari lokal sebelum/sesudah deploy karena Vercel tidak menjalankan migrasi secara otomatis.

---

## Troubleshooting Cepat

| Gejala | Penyebab Umum | Solusi |
| :--- | :--- | :--- |
| Request frontend diblokir **CORS** | `CORS_ORIGINS` belum berisi domain frontend Vercel, atau ada trailing `/` | Samakan persis `https://...vercel.app` di `CORS_ORIGINS` backend, lalu **Redeploy** backend |
| `/health` error **503 DATABASE_UNAVAILABLE** | `DATABASE_URL` salah, bukan SSL, atau Neon bermasalah | Pastikan `DATABASE_URL` memakai `-pooler` + `?sslmode=require` dan `DB_SSL=true` |
| Upload bukti error **413** | Ukuran foto melebihi batas payload Vercel (4.5 MB) | Kompresi gambar di browser sebelum upload |
| OCR error **504 Gateway Timeout** | Layanan AI merespons lebih lama dari timeout serverless Vercel | Cek log Layanan AI, pastikan respon AI < 9 detik atau aktifkan Fluid Compute |
| Frontend masih memanggil `localhost:5000` | `VITE_API_URL` baru diisi setelah build | Pastikan `VITE_API_URL` tersimpan di Production env, lalu **Redeploy** frontend |
