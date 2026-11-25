# Kontrak API — Esbe Cash Recap

Dokumen ini menjadi kontrak antarmuka resmi antara:
- **Bagian A**: Layanan AI Ekstraksi Bukti (FastAPI, dikelola **Lutfy**) ↔ Backend Hapi.js
- **Bagian B**: Backend API (Hapi.js) ↔ Frontend React (dikelola **Adam**)

---

## 1. Konvensi Umum & Format Error Standar

### 1.1 Zona Waktu, Mata Uang, dan Tipe Data
- **Nominal Rupiah (`amount`)**: Bilangan bulat (`integer`) dalam Rupiah tanpa titik/desimal (contoh: `145000`). Di PostgreSQL disimpan sebagai `NUMERIC(15, 2)` namun API selalu mengirim/menerima integer Rupiah.
- **Waktu Transaksi**: Format **ISO 8601 dengan offset WIB (`+07:00`)** untuk field gabungan (`"2026-11-25T11:35:00+07:00"`), serta `YYYY-MM-DD` (`date`) dan `HH:mm` / `HH:mm:ss` (`time`) bila dipisah.
- **Role Pengguna**:
  - `owner` (juga kompatibel dengan alias `admin`): akses penuh — dashboard, rekap, melihat semua riwayat transaksi, mengubah, menghapus, serta meninjau indikasi duplikat.
  - `employee` (juga kompatibel dengan alias `operator`): akses terbatas — membuat transaksi (`tunai` maupun `extract` + konfirmasi) dan melihat transaksi miliknya sendiri (`created_by = user.id`).
- **Shift**: `"pagi"` (`06:00–14:00`), `"siang"` (`14:00–22:00`).
- **Metode Pembayaran**: `"tunai"`, `"qris"`, `"transfer"`.
- **Jenis Transaksi**: `"pemasukan"`, `"pengeluaran"`.

### 1.2 Format Error Standar

#### A. Layanan AI (FastAPI)
```json
{
  "success": false,
  "error": {
    "code": "UNREADABLE_PROOF",
    "message": "Gambar bukti terlalu buram atau terpotong sehingga nominal dan detail transaksi tidak dapat dibaca."
  }
}
```

#### B. Backend Hapi.js (`onPreResponse` Extension)
Seluruh error (`4xx` maupun `5xx`) wajib menggunakan format berikut:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Pesan ringkas yang aman ditampilkan ke pengguna",
    "details": {}
  }
}
```

---

## 2. Antarmuka A — Layanan AI (FastAPI → Dipanggil Backend)

- **Base URL**: `AI_SERVICE_URL` (contoh lokal: `http://localhost:8000`)
- **Autentikasi**: Header `X-API-Key: <AI_SERVICE_API_KEY>`
- **Kebijakan Timeout & Retry di Backend**:
  - Timeout HTTP client backend: **30 detik** (`AI_SERVICE_TIMEOUT_MS=30000`).
  - Retry otomatis: **maksimal 1x retry** khusus jika AI mengembalikan HTTP **`503` (`AI_UNAVAILABLE`)** atau **`504` (`AI_TIMEOUT`)**, atau terjadi *network/timeout error* pada request pertama (jeda 500 ms sebelum retry).
  - Error **`400`, `401/403`, `413`, `415`, `422`** **tidak** di-retry.
- **Aturan Anti-Tebakan (*No Guessing*)**: Jika salah satu field (`amount`, `transaction_time`, `transaction_id`, `source`) tidak terbaca jelas dari OCR maupun `llm_fallback`, layanan AI **wajib mengisi field tersebut dengan `null`** (bukan nilai tebakan) dan menurunkan skor `confidence` terkait menjadi `0`.

---

### A.1 `GET /health` (Layanan AI)
- **Method & Path**: `GET /health`
- **Role / Auth**: Internal Backend (tanpa `X-API-Key` atau opsional sesuai kesiapan FastAPI untuk probe Render)
- **Request**: Tidak ada body/query.

**Response Sukses (`200 OK`)**:
```json
{
  "status": "ok",
  "service": "esbe-ai-extractor",
  "ocr_ready": true,
  "llm_fallback_ready": true,
  "timestamp": "2026-11-25T19:45:00+07:00"
}
```

**Response Error (`503 Service Unavailable`)**:
```json
{
  "success": false,
  "error": {
    "code": "AI_UNAVAILABLE",
    "message": "Engine OCR atau layanan LLM belum siap menerima permintaan."
  }
}
```

---

### A.2 `POST /extract` (Layanan AI)
- **Method & Path**: `POST /extract`
- **Role / Auth**: Internal Backend — wajib header `X-API-Key: <AI_SERVICE_API_KEY>`
- **Request**:
  - `Content-Type`: `multipart/form-data`
  - Form field `file`: file gambar bukti pembayaran (`image/jpeg`, `image/png`, `image/webp`), ukuran maksimal **5 MB** (`5242880` bytes).

**Response Sukses (`200 OK` — Seluruh Field Terbaca)**:
```json
{
  "success": true,
  "data": {
    "amount": 145000,
    "transaction_time": "2026-11-25T11:35:00+07:00",
    "transaction_id": "NMID-992144812",
    "source": "QRIS",
    "confidence": {
      "amount": 0.98,
      "transaction_time": 0.94,
      "transaction_id": 0.91,
      "source": 0.99
    },
    "method_used": "ocr",
    "image_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "image_phash": "a4d3c2b1e0f98765",
    "warnings": []
  }
}
```

**Response Sukses (`200 OK` — Sebagian Field Tidak Terbaca → `null`)**:
```json
{
  "success": true,
  "data": {
    "amount": 75000,
    "transaction_time": null,
    "transaction_id": null,
    "source": "transfer",
    "confidence": {
      "amount": 0.89,
      "transaction_time": 0.0,
      "transaction_id": 0.0,
      "source": 0.85
    },
    "method_used": "llm_fallback",
    "image_sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "image_phash": "8f12c34a7b910e22",
    "warnings": [
      "UNREADABLE_TIME",
      "UNREADABLE_TRANSACTION_ID"
    ]
  }
}
```

**Daftar Kode Error (`POST /extract`)**:

| HTTP Status | `error.code` | Kondisi | Contoh JSON |
|---|---|---|---|
| `400` | `INVALID_IMAGE` | File kosong, korup, atau gagal didekode sebagai gambar | `{"success":false,"error":{"code":"INVALID_IMAGE","message":"File gambar tidak valid atau rusak."}}` |
| `413` | `FILE_TOO_LARGE` | Ukuran file melebihi 5 MB | `{"success":false,"error":{"code":"FILE_TOO_LARGE","message":"Ukuran file melebihi batas maksimal 5 MB."}}` |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Format bukan `jpg`, `jpeg`, `png`, atau `webp` | `{"success":false,"error":{"code":"UNSUPPORTED_MEDIA_TYPE","message":"Format file tidak didukung. Gunakan JPG, PNG, atau WEBP."}}` |
| `422` | `UNREADABLE_PROOF` | Struk/screenshot terlalu buram/gelap sehingga tidak ada data relevan yang terbaca | `{"success":false,"error":{"code":"UNREADABLE_PROOF","message":"Bukti pembayaran tidak dapat dibaca. Silakan foto ulang atau isi manual."}}` |
| `500` | `INTERNAL_ERROR` | Kegagalan tak terduga di pipeline AI | `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"Terjadi kesalahan internal pada layanan AI."}}` |
| `503` | `AI_UNAVAILABLE` | Model/engine OCR atau LLM tidak tersedia (memicu 1x retry dari backend) | `{"success":false,"error":{"code":"AI_UNAVAILABLE","message":"Layanan ekstraksi AI sedang tidak tersedia."}}` |
| `504` | `AI_TIMEOUT` | Proses inferensi AI melampaui batas waktu (memicu 1x retry dari backend) | `{"success":false,"error":{"code":"AI_TIMEOUT","message":"Waktu pemrosesan layanan AI habis."}}` |

---

## 3. Antarmuka B — API Backend (Hapi.js → Dipanggil Frontend)

- **Base URL**: `http://localhost:5000` (atau URL Render backend)
- **CORS**: Dibatasi ke origin yang tercantum di env `CORS_ORIGINS` (mendukung `credentials: true`).

---

### B.1 `POST /auth/login`
- **Method & Path**: `POST /auth/login`
- **Role / Auth**: Publik (`auth: false`) + Rate Limiter (default: maks 10 percobaan/menit per IP).
- **Request Body (`application/json`)**:
```json
{
  "username": "owner",
  "password": "owner123"
}
```
- **Response Sukses (`200 OK`)**:
```json
{
  "status": "success",
  "message": "Login berhasil",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "owner",
      "role": "owner"
    }
  }
}
```
- **Response Error**:
  - `400 VALIDATION_ERROR` (username/password kosong)
  - `401 INVALID_CREDENTIALS` (kredensial salah, pesan generik)
  - `403 ACCOUNT_INACTIVE` (akun non-aktif)
  - `429 RATE_LIMIT_EXCEEDED` (melebihi batas percobaan login)
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Username atau password salah",
    "details": {}
  }
}
```

---

### B.2 `GET /auth/me`
- **Method & Path**: `GET /auth/me`
- **Role / Auth**: `owner` | `employee` (Wajib header `Authorization: Bearer <token>`)
- **Request**: Tidak ada body/query.
- **Response Sukses (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 2,
      "username": "employee",
      "role": "employee"
    }
  }
}
```
- **Response Error (`401 UNAUTHORIZED`)**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authentication",
    "details": {}
  }
}
```

---

### B.3 `POST /transactions/cash`
Mencatat transaksi tunai langsung (pemasukan atau pengeluaran kas laci) tanpa proses ekstraksi AI.
- **Method & Path**: `POST /transactions/cash`
- **Role / Auth**: `owner` | `employee` (`Authorization: Bearer <token>`)
- **Request Body (`application/json`)**:
```json
{
  "title": "Fotokopi Modul & Jilid Skripsi",
  "transaction_type": "pemasukan",
  "category_id": 1,
  "shift": "pagi",
  "amount": 145000,
  "transaction_date": "2026-11-25",
  "transaction_time": "09:15:00",
  "notes": "Pelanggan mahasiswa, bayar uang pas"
}
```
- **Response Sukses (`201 Created`)**:
```json
{
  "status": "success",
  "message": "Transaksi tunai berhasil disimpan",
  "data": {
    "transaction": {
      "id": 101,
      "title": "Fotokopi Modul & Jilid Skripsi",
      "transaction_type": "pemasukan",
      "category": "Jasa Fotokopi",
      "payment_method": "tunai",
      "shift": "pagi",
      "amount": 145000,
      "transaction_date": "2026-11-25",
      "transaction_time": "09:15:00",
      "transaction_status": "completed",
      "is_duplicate": false,
      "created_by": 2,
      "created_at": "2026-11-25T09:15:12+07:00"
    }
  }
}
```
- **Response Error (`400 VALIDATION_ERROR` / `401 UNAUTHORIZED`)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Nominal harus lebih besar dari 0",
    "details": {
      "fields": [
        { "field": "amount", "message": "Nominal harus lebih besar dari 0" }
      ]
    }
  }
}
```

---

### B.4 `POST /transactions/extract`
Mengunggah gambar bukti pembayaran (`multipart/form-data`), menghitung SHA-256, memanggil Layanan AI `POST /extract` (timeout 30 detik, retry 1x untuk `503`/`504`), menjalankan pengecekan duplikat, dan mengembalikan draf transaksi + flag duplikat (atau fallback `manual_input_required: true` jika AI gagal/lambat).
- **Method & Path**: `POST /transactions/extract`
- **Role / Auth**: `owner` | `employee` (`Authorization: Bearer <token>`)
- **Request (`multipart/form-data`)**:
  - `file` (wajib): File gambar `jpg`/`jpeg`/`png`/`webp`, maksimal **5 MB**.
  - `shift` (opsional): `"pagi"` | `"siang"` (jika kosong, backend menebak dari jam saat ini WIB atau mengembalikan default).
  - `payment_method` (opsional): `"qris"` | `"transfer"` (hint awal dari kasir).
  - `mock_scenario` (opsional, khusus mock/pengujian): `"success"` (default) | `"duplicate"` | `"partial"` | `"ai_fallback"`.
- **Response Sukses (`200 OK` — Ekstraksi Berhasil & Tidak Duplikat)**:
```json
{
  "status": "success",
  "message": "Bukti pembayaran berhasil diproses",
  "data": {
    "is_mock": true,
    "manual_input_required": false,
    "ai_status": "success",
    "fallback_reason": null,
    "proof": {
      "proof_id": 501,
      "storage_key": "proofs/2026/11/25/mock-proof-e3b0c442.jpg",
      "original_filename": "struk-qris.jpg",
      "mime_type": "image/jpeg",
      "file_size": 248310,
      "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "image_phash": "a4d3c2b1e0f98765"
    },
    "extraction": {
      "amount": 145000,
      "transaction_time": "2026-11-25T11:35:00+07:00",
      "transaction_id": "NMID-992144812",
      "source": "QRIS",
      "confidence": {
        "amount": 0.98,
        "transaction_time": 0.94,
        "transaction_id": 0.91,
        "source": 0.99
      },
      "method_used": "ocr",
      "warnings": []
    },
    "duplicate_check": {
      "is_duplicate": false,
      "severity": "none",
      "warning_title": null,
      "warning_message": null,
      "matches": []
    },
    "draft": {
      "payment_proof_id": 501,
      "title": "Pembayaran QRIS",
      "transaction_type": "pemasukan",
      "payment_method": "qris",
      "shift": "pagi",
      "amount": 145000,
      "transaction_date": "2026-11-25",
      "transaction_time": "11:35:00",
      "transaction_reference": "NMID-992144812",
      "is_duplicate": false
    }
  }
}
```
- **Response Sukses (`200 OK` — Indikasi Duplikat Terdeteksi)**:
```json
{
  "status": "success",
  "message": "Bukti diproses dengan peringatan duplikat",
  "data": {
    "is_mock": true,
    "manual_input_required": false,
    "ai_status": "success",
    "fallback_reason": null,
    "proof": {
      "proof_id": 502,
      "storage_key": "proofs/2026/11/25/mock-proof-9f86d081.jpg",
      "original_filename": "struk-qris-ulang.jpg",
      "mime_type": "image/jpeg",
      "file_size": 248310,
      "sha256_hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "image_phash": "a4d3c2b1e0f98765"
    },
    "extraction": {
      "amount": 145000,
      "transaction_time": "2026-11-25T11:35:00+07:00",
      "transaction_id": "NMID-992144812",
      "source": "QRIS",
      "confidence": {
        "amount": 0.98,
        "transaction_time": 0.94,
        "transaction_id": 0.91,
        "source": 0.99
      },
      "method_used": "ocr",
      "warnings": []
    },
    "duplicate_check": {
      "is_duplicate": true,
      "severity": "high",
      "warning_title": "Bukti terindikasi duplikat",
      "warning_message": "ID transaksi NMID-992144812 dengan nominal Rp 145.000 cocok dengan transaksi #42. Anda tetap dapat menyimpan transaksi dengan status Perlu ditinjau.",
      "matches": [
        {
          "matched_transaction_id": 42,
          "match_method": "reference_exact",
          "similarity_score": 98.0,
          "matched_amount": 145000,
          "matched_date": "2026-11-25",
          "matched_time": "11:35:00",
          "matched_reference": "NMID-992144812"
        }
      ]
    },
    "draft": {
      "payment_proof_id": 502,
      "title": "Pembayaran QRIS",
      "transaction_type": "pemasukan",
      "payment_method": "qris",
      "shift": "pagi",
      "amount": 145000,
      "transaction_date": "2026-11-25",
      "transaction_time": "11:35:00",
      "transaction_reference": "NMID-992144812",
      "is_duplicate": true
    }
  }
}
```
- **Response Error (`400 VALIDATION_ERROR` / `401 UNAUTHORIZED` / `413 FILE_TOO_LARGE` / `415 UNSUPPORTED_MEDIA_TYPE`)**:
```json
{
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "Format file tidak didukung. Unggah gambar JPG, PNG, atau WEBP.",
    "details": {
      "allowedMimeTypes": ["image/jpeg", "image/png", "image/webp"],
      "receivedMimeType": "application/pdf"
    }
  }
}
```

---

### B.5 `POST /transactions`
Menyimpan dan mengonfirmasi transaksi final (baik dari draf `POST /transactions/extract` yang dikoreksi kasir maupun input manual saat `manual_input_required: true`).
- **Method & Path**: `POST /transactions`
- **Role / Auth**: `owner` | `employee` (`Authorization: Bearer <token>`)
- **Request Body (`application/json`)**:
```json
{
  "payment_proof_id": 501,
  "title": "Print Warna & Kertas HVS 5 Rim",
  "transaction_type": "pemasukan",
  "category_id": 2,
  "payment_method": "qris",
  "shift": "pagi",
  "amount": 145000,
  "transaction_date": "2026-11-25",
  "transaction_time": "11:35:00",
  "transaction_reference": "NMID-992144812",
  "notes": "Pembayaran QRIS Merchant Esbe",
  "is_duplicate": false
}
```
- **Response Sukses (`201 Created`)**:
```json
{
  "status": "success",
  "message": "Transaksi berhasil dikonfirmasi dan disimpan",
  "data": {
    "transaction": {
      "id": 102,
      "payment_proof_id": 501,
      "title": "Print Warna & Kertas HVS 5 Rim",
      "transaction_type": "pemasukan",
      "category": "Percetakan & ATK",
      "payment_method": "qris",
      "shift": "pagi",
      "amount": 145000,
      "transaction_date": "2026-11-25",
      "transaction_time": "11:35:00",
      "transaction_reference": "NMID-992144812",
      "transaction_status": "completed",
      "is_duplicate": false,
      "created_by": 2,
      "confirmed_by": 2,
      "created_at": "2026-11-25T11:36:04+07:00"
    }
  }
}
```
*(Jika `is_duplicate: true`, `transaction_status` otomatis diset `"pending_review"` dan tercatat di tabel `duplicate_checks`.)*
- **Response Error (`400 VALIDATION_ERROR` / `404 NOT_FOUND` jika `payment_proof_id` atau `category_id` tidak ditemukan)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Bukti pembayaran dengan ID 9999 tidak ditemukan",
    "details": {}
  }
}
```

---

### B.6 `GET /transactions`
Mengambil daftar riwayat transaksi dengan filter dan paginasi.
- **Method & Path**: `GET /transactions`
- **Role / Auth**:
  - `owner`: melihat seluruh transaksi semua karyawan.
  - `employee`: **hanya** melihat transaksi yang dibuat oleh dirinya sendiri (`created_by = user.id`).
- **Query Parameters**:
  - `date_from` (opsional, `YYYY-MM-DD`)
  - `date_to` (opsional, `YYYY-MM-DD`)
  - `shift` (opsional: `pagi` | `siang`)
  - `payment_method` (opsional: `tunai` | `qris` | `transfer`)
  - `transaction_type` (opsional: `pemasukan` | `pengeluaran`)
  - `status` (opsional: `completed` | `pending_review` | `rejected`)
  - `search` (opsional: kata kunci `title` / `notes` / `transaction_reference`)
  - `page` (opsional, default `1`), `limit` (opsional, default `20`, maks `100`)
- **Contoh Request**:
  `GET /transactions?date_from=2026-11-25&date_to=2026-11-25&shift=pagi&payment_method=qris&status=completed&page=1&limit=20`
- **Response Sukses (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": 102,
        "title": "Print Warna & Kertas HVS 5 Rim",
        "transaction_type": "pemasukan",
        "category": "Percetakan & ATK",
        "payment_method": "qris",
        "shift": "pagi",
        "amount": 145000,
        "transaction_date": "2026-11-25",
        "transaction_time": "11:35:00",
        "transaction_status": "completed",
        "is_duplicate": false,
        "created_by": {
          "id": 2,
          "username": "employee"
        },
        "proof_url": "https://cdn.example.com/proofs/2026/11/25/mock-proof-e3b0c442.jpg"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total_items": 1,
      "total_pages": 1
    }
  }
}
```
- **Response Error (`400 VALIDATION_ERROR` jika format tanggal/filter tidak valid / `401 UNAUTHORIZED`)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Format date_from harus YYYY-MM-DD",
    "details": {}
  }
}
```

---

### B.7 `GET /transactions/{id}`
- **Method & Path**: `GET /transactions/{id}`
- **Role / Auth**:
  - `owner`: dapat melihat detail transaksi mana pun.
  - `employee`: hanya dapat melihat transaksi yang `created_by === user.id` (selain itu ditolak `403 FORBIDDEN`).
- **Response Sukses (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "transaction": {
      "id": 102,
      "title": "Print Warna & Kertas HVS 5 Rim",
      "transaction_type": "pemasukan",
      "category_id": 2,
      "category": "Percetakan & ATK",
      "payment_method": "qris",
      "shift": "pagi",
      "amount": 145000,
      "transaction_date": "2026-11-25",
      "transaction_time": "11:35:00",
      "transaction_status": "completed",
      "notes": "Pembayaran QRIS Merchant Esbe",
      "is_duplicate": false,
      "created_by": 2,
      "proof": {
        "proof_id": 501,
        "storage_key": "proofs/2026/11/25/mock-proof-e3b0c442.jpg",
        "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      "duplicate_check": null,
      "created_at": "2026-11-25T11:36:04+07:00",
      "update_at": "2026-11-25T11:36:04+07:00"
    }
  }
}
```
- **Response Error (`403 FORBIDDEN` / `404 NOT_FOUND`)**:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Anda tidak memiliki izin melihat transaksi milik pengguna lain",
    "details": {}
  }
}
```

---

### B.8 `PATCH /transactions/{id}`
Mengubah nominal, keterangan, metode, shift, kategori, atau meninjau status transaksi/duplikat. Setiap perubahan dicatat ke `transaction_audit_logs`.
- **Method & Path**: `PATCH /transactions/{id}`
- **Role / Auth**: **`owner` only** (`requireRole('owner')` → `employee` ditolak `403 FORBIDDEN`).
- **Request Body (`application/json`, minimal 1 field diisi)**:
```json
{
  "amount": 150000,
  "transaction_status": "completed",
  "is_duplicate": false,
  "notes": "Sudah diverifikasi pemilik melalui mutasi QRIS"
}
```
- **Response Sukses (`200 OK`)**:
```json
{
  "status": "success",
  "message": "Transaksi berhasil diperbarui",
  "data": {
    "transaction": {
      "id": 102,
      "amount": 150000,
      "transaction_status": "completed",
      "is_duplicate": false,
      "notes": "Sudah diverifikasi pemilik melalui mutasi QRIS",
      "update_at": "2026-11-25T14:10:00+07:00"
    }
  }
}
```
- **Response Error (`400 VALIDATION_ERROR` / `403 FORBIDDEN` / `404 NOT_FOUND`)**:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Anda tidak memiliki hak akses untuk fitur ini",
    "details": {
      "requiredRoles": ["owner"],
      "currentRole": "employee"
    }
  }
}
```

---

### B.9 `DELETE /transactions/{id}`
Menghapus transaksi dan mencatat snapshot data lama ke `transaction_audit_logs`.
- **Method & Path**: `DELETE /transactions/{id}`
- **Role / Auth**: **`owner` only** (`requireRole('owner')` → `employee` ditolak `403 FORBIDDEN`).
- **Response Sukses (`200 OK`)**:
```json
{
  "status": "success",
  "message": "Transaksi berhasil dihapus",
  "data": {
    "deleted_id": 102
  }
}
```
- **Response Error (`403 FORBIDDEN` / `404 NOT_FOUND`)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Transaksi tidak ditemukan",
    "details": {}
  }
}
```

---

### B.10 `GET /recap?date_from&date_to&group_by`
Menghasilkan laporan rekapitulasi pendapatan & pengeluaran teragregasi.
- **Method & Path**: `GET /recap`
- **Role / Auth**: **`owner` only** (`requireRole('owner')`).
- **Query Parameters**:
  - `date_from` (wajib, `YYYY-MM-DD`)
  - `date_to` (wajib, `YYYY-MM-DD`)
  - `group_by` (opsional, default `"day"`): `"day"` | `"shift"` | `"payment_method"` | `"category"`
- **Contoh Request**: `GET /recap?date_from=2026-11-20&date_to=2026-11-25&group_by=payment_method`
- **Response Sukses (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "period": {
      "date_from": "2026-11-20",
      "date_to": "2026-11-25",
      "group_by": "payment_method"
    },
    "totals": {
      "total_pemasukan": 1850000,
      "total_pengeluaran": 320000,
      "saldo_bersih": 1530000,
      "transaction_count": 24
    },
    "breakdown": [
      {
        "key": "tunai",
        "label": "Tunai",
        "pemasukan": 850000,
        "pengeluaran": 320000,
        "bersih": 530000,
        "count": 12
      },
      {
        "key": "qris",
        "label": "QRIS Merchant",
        "pemasukan": 650000,
        "pengeluaran": 0,
        "bersih": 650000,
        "count": 9
      },
      {
        "key": "transfer",
        "label": "Transfer Bank",
        "pemasukan": 350000,
        "pengeluaran": 0,
        "bersih": 350000,
        "count": 3
      }
    ]
  }
}
```
- **Response Error (`400 VALIDATION_ERROR` jika `date_from > date_to` atau `group_by` tidak valid / `403 FORBIDDEN`)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Parameter date_from tidak boleh lebih besar dari date_to",
    "details": {}
  }
}
```

---

### B.11 `GET /dashboard/summary`
Menyediakan ringkasan metrik harian/periode untuk halaman Dashboard Pemilik.
- **Method & Path**: `GET /dashboard/summary`
- **Role / Auth**: **`owner` only** (`requireRole('owner')`).
- **Query Parameters**:
  - `date` (opsional, `YYYY-MM-DD`, default tanggal hari ini WIB)
  - `shift` (opsional: `all` | `pagi` | `siang`, default `all`)
- **Response Sukses (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "date": "2026-11-25",
    "shift_filter": "all",
    "summary": {
      "total_pemasukan": 770000,
      "total_pengeluaran": 180000,
      "total_bersih": 590000,
      "pending_review_count": 1
    },
    "by_payment_method": {
      "tunai": 145000,
      "qris": 275000,
      "transfer": 350000
    },
    "by_shift": {
      "pagi": { "pemasukan": 420000, "pengeluaran": 0 },
      "siang": { "pemasukan": 350000, "pengeluaran": 180000 }
    }
  }
}
```
- **Response Error (`403 FORBIDDEN` / `401 UNAUTHORIZED`)**:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Anda tidak memiliki hak akses untuk fitur ini",
    "details": {
      "requiredRoles": ["owner"],
      "currentRole": "employee"
    }
  }
}
```

---

### B.12 `GET /health`
- **Method & Path**: `GET /health`
- **Role / Auth**: Publik (`auth: false`)
- **Response Sukses (`200 OK`)**:
```json
{
  "status": "ok",
  "service": "esbe-cash-recap-backend",
  "database": "connected",
  "latencyMs": 12,
  "timestamp": "2026-11-25T12:45:00.000Z"
}
```
- **Response Error (`503 Service Unavailable`)**:
```json
{
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Koneksi database gagal",
    "details": {
      "database": "disconnected"
    }
  }
}
```

---

## 4. Strategi Fallback Saat Layanan AI Gagal atau Lambat (`manual_input_required: true`)

Operasional kasir toko fotokopi tidak boleh terhenti meskipun layanan AI FastAPI mengalami *cold start*, timeout, gangguan jaringan, atau gambar bukti terlalu buram.

### Alur Penanganan di Backend (`POST /transactions/extract`)
1. Validasi file upload terlebih dahulu (`<= 5 MB`, MIME `jpg`/`png`/`webp`).
2. Simpan file bukti dan hitung `sha256_hash`, lalu lakukan pengecekan duplikat berbasis SHA-256 (`sha256_exact`) agar tetap berjalan meski AI gagal.
3. Panggil AI Service `POST /extract` dengan **timeout 30 detik**.
   - Jika mendapat `503`, `504`, atau *network/timeout error*: **retry 1x** setelah jeda singkat (`500 ms`).
4. Jika percobaan retry tetap gagal (`503`/`504`/timeout/koneksi putus), atau AI mengembalikan `422 UNREADABLE_PROOF`, atau field penting seperti `amount` terbaca `null`:
   - Backend **tidak** melempar error `5xx` yang memblokir layar kasir.
   - Backend tetap mengembalikan **HTTP `200 OK`** dengan **`manual_input_required: true`**, `ai_status` (`"timeout"` | `"unavailable"` | `"unreadable"` | `"partial"`), `fallback_reason`, serta `proof_id` yang sudah tersimpan.
   - Di Frontend, form konfirmasi otomatis mengaktifkan mode **Input Manual** (menampilkan gambar bukti di sebelah kiri dan form kosong siap ketik di sebelah kanan) untuk disimpan lewat `POST /transactions`.

### Contoh Response Fallback (`200 OK`, `manual_input_required: true`)
```json
{
  "status": "success",
  "message": "Layanan AI tidak merespons tepat waktu. Silakan isi data transaksi secara manual.",
  "data": {
    "is_mock": true,
    "manual_input_required": true,
    "ai_status": "timeout",
    "fallback_reason": {
      "code": "AI_TIMEOUT",
      "message": "Ekstraksi otomatis melebihi batas waktu 30 detik (sudah dicoba ulang 1x)."
    },
    "proof": {
      "proof_id": 503,
      "storage_key": "proofs/2026/11/25/mock-proof-7c21a904.jpg",
      "original_filename": "struk-buram.jpg",
      "mime_type": "image/jpeg",
      "file_size": 192400,
      "sha256_hash": "7c21a904c51b2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e",
      "image_phash": null
    },
    "extraction": null,
    "duplicate_check": {
      "is_duplicate": false,
      "severity": "none",
      "warning_title": null,
      "warning_message": null,
      "matches": []
    },
    "draft": {
      "payment_proof_id": 503,
      "title": "Pembayaran non-tunai",
      "transaction_type": "pemasukan",
      "payment_method": "qris",
      "shift": "pagi",
      "amount": null,
      "transaction_date": "2026-11-25",
      "transaction_time": null,
      "transaction_reference": null,
      "is_duplicate": false
    }
  }
}
```

---

## 5. Aturan Deteksi Duplikat & Bentuk Peringatannya

Deteksi duplikat dirancang untuk mencegah bukti pembayaran yang sama dicatat dua kali (baik sengaja maupun tidak sengaja antar-shift/kasir), namun **bersifat non-blocking** (kasir tetap bisa menyimpan apabila memang perlu, dengan penandaan otomatis untuk ditinjau pemilik).

### 5.1 Aturan Pencocokan (Berurutan dari Tingkat Keyakinan Tertinggi)

| Prioritas | `match_method` | Kriteria Pencocokan | `similarity_score` | `severity` |
|---|---|---|---|---|
| 1 | `sha256_exact` | `payment_proofs.sha256_hash` sama persis dengan bukti yang sudah terkait transaksi aktif | `100.00` | `high` |
| 2 | `reference_exact` | `transaction_reference` (`transaction_id` hasil OCR, mis. `NMID-...` / RRN) sama persis dan tidak kosong | `98.00` | `high` |
| 3 | `phash_similar` | Jarak Hamming `image_phash` $\le 5$ bit terhadap bukti sebelumnya (menangkap screenshot ulang / gambar dikompresi) | `90.00` – `99.00` | `high` / `medium` |
| 4 | `amount_time_window` | Kombinasi `amount` sama + `payment_method` sama + selisih waktu transaksi $\le 5$ menit pada tanggal yang sama | `80.00` | `medium` |

### 5.2 Bentuk Peringatan & Status Tindak Lanjut
1. **Saat Preview (`POST /transactions/extract`)**:
   - Objek `duplicate_check` berisi `is_duplicate: true`, `severity`, `warning_title`, `warning_message`, dan array `matches` berisi ID transaksi yang mirip beserta nominal dan waktunya.
   - Frontend menampilkan banner peringatan kuning/oranye di atas form konfirmasi serta mengubah label tombol simpan menjadi *"Simpan dengan tanda Perlu ditinjau"*.
2. **Saat Konfirmasi (`POST /transactions`)**:
   - Jika terindikasi duplikat (`is_duplicate: true`), transaksi disimpan dengan `transaction_status = "pending_review"` dan baris baru dibuat di tabel `duplicate_checks` (`review_status = "pending"`).
   - Pada Dashboard Pemilik (`GET /dashboard/summary`), angka `pending_review_count` bertambah sehingga Owner dapat meninjau di Riwayat Transaksi lalu menyetujui (`status: "completed", is_duplicate: false`) atau menghapus transaksi ganda (`DELETE /transactions/{id}`).

---

## 6. Daftar Pertanyaan Terbuka untuk Lutfy & Adam

### Pertanyaan untuk Lutfy (Layanan AI — FastAPI)
1. **Cold Start Hosting Gratis**: Jika layanan FastAPI berjalan di Render free tier (*spin down* setelah tidak aktif 15 menit), apakah *cold start* + inferensi pertama bisa melebihi 30 detik? Apakah perlu endpoint ringan atau jadwal *keep-alive* sebelum jam buka toko?
2. **Format Nilai `source` dan `transaction_id`**: Apakah nilai `source` akan selalu tepat salah satu dari `"QRIS"`, `"transfer"`, `"bank"` (case-sensitive)? Dan untuk `transaction_id`, apakah menormalisasi label (mis. RRN/Ref/No. Referensi) menjadi string bersih tanpa spasi?
3. **Perhitungan `image_phash` saat `422 UNREADABLE_PROOF`**: Jika teks struk tidak terbaca (`422`), apakah FastAPI hanya mengembalikan error atau tetap bisa menyertakan hash gambar? (Alternatif: backend selalu menghitung `image_sha256` sendiri, dan `image_phash` bersifat opsional jika AI gagal).
4. **Tanggal Tanpa Tahun pada Struk**: Beberapa aplikasi m-banking/QRIS hanya mencetak jam (`11:35`) tanpa tanggal lengkap. Dalam kondisi itu, apakah `transaction_time` diisi `null` agar tidak menebak, atau dilengkapi tanggal hari ini `+07:00`?
5. **Proteksi `GET /health` AI**: Apakah `GET /health` di FastAPI dibuka tanpa `X-API-Key` agar mudah dipantau oleh health-check platform deployment?

### Pertanyaan untuk Adam (Frontend & Infrastruktur)
1. **Lokasi Penyimpanan Gambar Bukti (Ephemeral Filesystem Render Free)**: Filesystem lokal pada Render free tier bersifat sementara (*ephemeral*) — seluruh file unggahan di disk akan terhapus setiap kali server restart atau deploy ulang. Ke mana gambar bukti (`storage_key` di tabel `payment_proofs`) akan disimpan secara permanen?
   - *Opsi yang disarankan*: **Cloudflare R2** (gratis 10 GB/bulan, kompatibel S3) atau **Supabase Storage** / **Cloudinary**, sehingga `storage_key` menyimpan key/URL object storage tersebut.
2. **Alur Upload Gambar ke Storage**: Apakah Frontend akan mengunggah langsung ke object storage (*presigned URL*) atau mengirim `multipart/form-data` ke Backend `POST /transactions/extract` lalu Backend yang meneruskan ke AI dan menyimpannya ke object storage?
3. **Penyeragaman `baseURL` Frontend**: Di `frontend/src/services/api.js`, `baseURL` saat ini bernilai `http://localhost:5000/api/v1`, sedangkan endpoint di kontrak ini menggunakan root path (`/auth/login`, `/transactions/extract`, dst.). Apakah frontend menghapus `/api/v1` atau seluruh route backend diprefix `/api/v1`?
4. **Kompresi Foto Sebelum Upload**: Foto kamera ponsel umumnya berukuran 6–12 MB (melebihi batas 5 MB). Apakah frontend akan melakukan *resize/compress* di browser (mis. maks lebar 1600px, kualitas JPEG 80%) sebelum mengirim ke `POST /transactions/extract`?
5. **Penyesuaian Role & Tampilan Menu di Frontend**: Kontrak menggunakan role `'owner'` dan `'employee'` (sedangkan mockup `LoginPage.jsx` sebelumnya menggunakan `'Admin'`/`'Operator'`). Apakah halaman Dashboard, Rekap, serta tombol Edit/Hapus di `HistoryPage.jsx` sudah disiapkan agar hanya muncul untuk role `'owner'`?
