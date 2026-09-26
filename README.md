# Siaga Bencana

Aplikasi manajemen bencana untuk pemantauan posko evakuasi, logistik, kondisi fasilitas shelter, dan data pengungsi — dilengkapi landing page publik dengan peta lokasi posko (Leaflet + OpenStreetMap) yang bisa diakses tanpa login.

## Tech Stack

| Komponen | Teknologi |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Bahasa | TypeScript + React 19 |
| Database | PostgreSQL + Prisma ORM 7 |
| Styling | Tailwind CSS 4 |
| Peta | Leaflet + OpenStreetMap (react-leaflet) |
| Autentikasi | Cookie-based session (custom, bcryptjs) |

## Struktur Proyek

```
src/
├── app/
│   ├── public/            # Landing page publik (tanpa login)
│   ├── login/             # Halaman login
│   ├── dashboard/         # Dashboard statistik
│   ├── kelola-posko/      # CRUD posko (+ [id] detail, [id]/edit)
│   ├── logistik/          # CRUD logistik
│   ├── shelter/           # CRUD laporan fasilitas
│   ├── pengungsi/          # CRUD pengungsi + check-out
│   ├── users/             # Manajemen pengguna (Super Admin)
│   └── api/               # Route handlers (REST)
├── components/
│   ├── ui/                # Button, Badge, Modal, Table, Form, Alert
│   ├── layout/            # Sidebar, Header, LayoutWrapper
│   ├── auth/              # AuthGuard
│   └── public/            # CampMap (peta)
├── lib/
│   ├── prisma.ts          # Prisma client singleton
│   ├── seed.ts            # Script seed data
│   └── auth/              # session.ts, guard.ts
└── proxy.ts               # Redirect "/" → "/public"
prisma/
├── schema.prisma          # Skema database
└── migrations/            # Migrasi Prisma
```

---

## Setup dari Awal

### Prasyarat

- **Node.js 20+** dan npm
- **PostgreSQL** berjalan lokal (atau connection string eksternal)

### 1. Clone & Install Dependensi

```bash
git clone <repo-url> siaga-bencana
cd siaga-bencana
npm install
```

### 2. Konfigurasi Environment

Buat file `.env` di root proyek:

```env
DATABASE_URL="postgresql://postgres:PASSWORD_ANDA@localhost:5432/siagabencana_db"
```

Sesuaikan username, password, host, port, dan nama database Anda.

### 3. Siapkan Database

Buat database terlebih dahulu (sekali saja):

```bash
psql -U postgres -c "CREATE DATABASE siagabencana_db;"
```

Jalankan migrasi Prisma (membuat seluruh tabel dari `prisma/migrations`):

```bash
npx prisma migrate deploy
```

> Untuk pengembangan, jika ingin membuat migrasi baru setelah mengubah `prisma/schema.prisma`:
> ```bash
> npx prisma migrate dev --name <nama-perubahan>
> ```

### 4. Seed Data (Opsional, Disarankan)

Mengisi database dengan data contoh: 3 posko, akun Super Admin, Manager, Field Officer, logistik, fasilitas, dan pengungsi:

```bash
npm run db:seed
```

### 5. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) — akan otomatis diarahkan ke halaman publik `/public`.

### Perintah Lainnya

| Perintah | Fungsi |
| --- | --- |
| `npm run build` | Build produksi |
| `npm run start` | Jalankan build produksi |
| `npm run lint` | Jalankan ESLint |
| `npm run db:seed` | Seed data contoh |
| `npx prisma migrate deploy` | Terapkan migrasi |
| `npx prisma studio` | Buka Prisma Studio (GUI database) |

---

## Tata Cara Penggunaan

### 1. Halaman Publik — `/public`

Diakses **tanpa login**. Buka `http://localhost:3000/` (root otomatis di-redirect ke sini).

- **Statistik ringkas**: jumlah posko aktif, total kapasitas, penghuni, logistik bermasalah, fasilitas rusak
- **Peta lokasi posko**: marker berwarna sesuai okupansi — 🟢 hijau (<70%), 🟠 kuning (70–89%), 🔴 merah (≥90%). Klik marker untuk popup info, klik juga untuk menyorot kartu posko di bawahnya
- **Detail posko**: bar okupansi, sisa kapasitas, daftar logistik beserta status (Cukup/Menipis/Kritis/Rusak), dan kondisi fasilitas (Baik/Rusak/Dalam Perbaikan)

Untuk masuk dashboard, klik **"Masuk ke Dashboard"**.

### 2. Login — `/login`

Silakan gunakan akun bawaan hasil seed:

| Peran | Email | Password |
| --- | --- | --- |
| Super Admin | `admin@siagabencana.local` | `password` |
| Manager Logistik | `manager.logistik.candi@siagabencana.local` | `password` |
| Manager Shelter | `manager.shelter.candi@siagabencana.local` | `password` |
| Manager Data | `manager.data.candi@siagabencana.local` | `password` |
| Field Officer Logistik | `field.logistik.candi@siagabencana.local` | `password` |
| Field Officer Shelter | `field.shelter.candi@siagabencana.local` | `password` |
| Field Officer Data | `field.data.candi@siagabencana.local` | `password` |

> Sesuaikan email dan password akun Anda masing-masing melalui menu **Pengguna** (hanya Super Admin) setelah login.

Sesi berlaku **7 hari** (cookie `siaga_session`). Klik **Logout** di header untuk keluar.

### 3. Dashboard — `/dashboard`

Menampilkan kartu statistik (posko, kapasitas, okupansi, petugas, logistik kritis, fasilitas rusak, pengungsi) dan daftar seluruh posko.

### 4. Kelola Posko — `/kelola-posko`

**Akses tulis: hanya Super Admin.**

- **Tambah**: klik `+ Tambah Posko`, isi nama, alamat, latitude, longitude, dan kapasitas maksimal
- **Detail**: klik nama baris untuk melihat detail
- **Edit**: dari halaman detail, klik `Edit`
- **Toggle Status**: buka/tutup posko (ACTIVE ↔ CLOSED) — posko CLOSED tidak tampil di halaman publik
- **Hapus**: klik `Hapus` pada baris atau di halaman detail

### 5. Logistik — `/logistik`

**Akses tulis: Super Admin atau pengguna divisi LOGISTICS.**

- **Tambah**: pilih posko, isi nama barang, jumlah, unit (kg/dus/box/dll), status, dan catatan
- **Status**: Cukup (SUFFICIENT), Menipis (LOW), Kritis (CRITICAL), Rusak (SPOILED_OR_DAMAGED)
- **Hapus**: klik `Hapus` pada baris

> Pengguna non-Super Admin hanya melihat data logistik posko mereka sendiri.

### 6. Shelter — `/shelter`

**Akses tulis: Super Admin atau pengguna divisi SHELTER.**

- **Tambah**: pilih posko, isi nama fasilitas, status (Baik/Rusak/Dalam Perbaikan), dan deskripsi
- **Hapus**: klik `Hapus` pada baris

### 7. Pengungsi — `/pengungsi`

**Akses tulis: Super Admin atau pengguna divisi DATA_REGISTRATION.**

- **Tambah**: pilih posko, isi nama keluarga, jumlah keluarga, status kebutuhan khusus, dan catatan
  - Sistem otomatis menambah okupansi posko dan **menolak jika kapasitas penuh** (HTTP 409)
- **Check-out**: klik `Check-out` pada baris pengungsi yang masih aktif — okupansi posko otomatis berkurang
- **Hapus**: menghapus data pengungsi aktif juga mengurangi okupansi posko

### 8. Pengguna — `/users`

**Akses: hanya Super Admin.**

- **Tambah**: nama, email, password, peran (Super Admin/Manager/Field Officer), divisi, dan posko
  - Manager & Field Officer **wajib** memiliki divisi dan posko; Super Admin tidak
- **Edit**: ubah data termasuk reset password (kosongkan jika tidak diubah)
- **Hapus**: tidak bisa menghapus akun sendiri

---

## Matriks Hak Akses

| Aksi | SUPER_ADMIN | MANAGER | FIELD_OFFICER |
| --- | --- | --- | --- |
| Kelola posko (CRUD) | ✅ | ❌ | ❌ |
| Manajemen pengguna | ✅ | ❌ | ❌ |
| Logistik | ✅ (semua posko) | ✅ (divisi LOGISTICS) | ✅ (divisi LOGISTICS) |
| Shelter/fasilitas | ✅ (semua posko) | ✅ (divisi SHELTER) | ✅ (divisi SHELTER) |
| Pengungsi | ✅ (semua posko) | ✅ (divisi DATA_REGISTRATION) | ✅ (divisi DATA_REGISTRATION) |
| Lihat dashboard | ✅ | ✅ (posko sendiri) | ✅ (posko sendiri) |

---

## API Reference

Semua API mengembalikan JSON dengan format `{ success: boolean, message?: string, data?: ... }`.

### Publik (tanpa autentikasi)

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/public/overview` | Overview: posko + logistik + fasilitas + summary |
| GET | `/api/public/camps` | Daftar posko aktif + kapasitas |
| GET | `/api/public/camps/[id]` | Detail satu posko aktif |

### Autentikasi

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | `/api/auth/login` | Login (`{ email, password }`) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Profil user sesi aktif |

### Terproteksi (membutuhkan sesi login)

> Catatan: `GET /api/camps` dan `GET /api/camps/[id]` terbuka tanpa sesi (read-only); seluruh operasi tulis dan endpoint lainnya membutuhkan sesi valid.

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET/POST | `/api/camps` | List / buat posko |
| GET/PUT/DELETE | `/api/camps/[id]` | Detail / ubah / hapus posko |
| GET/POST | `/api/logistics` | List / buat item logistik |
| GET/PUT/DELETE | `/api/logistics/[id]` | Detail / ubah / hapus logistik |
| GET/POST | `/api/shelter` | List / buat laporan fasilitas |
| GET/PUT/DELETE | `/api/shelter/[id]` | Detail / ubah / hapus laporan |
| GET/POST | `/api/evacuees` | List / registrasi pengungsi |
| GET/PUT/DELETE | `/api/evacuees/[id]` | Detail / ubah / hapus pengungsi |
| POST | `/api/evacuees/[id]/checkout` | Check-out pengungsi |
| GET/POST | `/api/users` | List / buat pengguna |
| GET/PUT/DELETE | `/api/users/[id]` | Detail / ubah / hapus pengguna |
| GET | `/api/dashboard` | Statistik dashboard |

---

## Model Database

- **User** — akun dengan peran `SUPER_ADMIN` | `MANAGER` | `FIELD_OFFICER` dan divisi `LOGISTICS` | `SHELTER` | `DATA_REGISTRATION`
- **Camp** — posko: lokasi (lat/lng), kapasitas, okupansi, status `ACTIVE` | `CLOSED`
- **LogisticsItem** — item logistik per posko dengan status ketersediaan
- **FacilityReport** — laporan kondisi fasilitas per posko
- **EvacueeRecord** — data pengungsi per posko (registrasi & check-out)
- **Session** — sesi login (hash token, kedaluwarsa 7 hari)

Relasi: `User` → `Camp` (SetNull), sedangkan `LogisticsItem`, `FacilityReport`, dan `EvacueeRecord` → `Camp` (Cascade — ikut terhapus saat posko dihapus).

---

## Catatan Teknis

- **Root redirect**: `src/proxy.ts` me-redirect `/` → `/public` di sisi server sebelum React dirender
- **Guard**: route dashboard dijaga `AuthGuard` (client) + API mengembalikan 401 tanpa sesi
- **Peta**: hanya dirender di client (`ssr: false`) karena Leaflet membutuhkan `window`
- **Data publik**: endpoint publik tidak pernah mengekspos nama pengungsi, email, atau data pribadi — hanya agregat okupansi dan kondisi operasional
