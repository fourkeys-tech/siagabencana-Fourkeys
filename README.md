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
│   ├── monitoring/        # Monitoring operasional + peringatan
│   ├── peta/              # Peta bencana (Leaflet, admin)
│   ├── kelola-posko/      # CRUD posko (+ [id] detail, [id]/edit)
│   ├── logistik/          # CRUD logistik
│   ├── shelter/           # CRUD laporan fasilitas
│   ├── pengungsi/          # CRUD pengungsi + check-out
│   ├── users/             # Manajemen pengguna (Super Admin)
│   └── api/               # Route handlers (REST)
├── components/
│   ├── ui/                # Button, Badge, Modal, Table, Form, Alert, Card
│   ├── layout/            # Sidebar, Header, LayoutWrapper
│   ├── auth/              # AuthGuard, UserProvider
│   └── public/            # CampMap (peta)
├── lib/
│   ├── prisma.ts          # Prisma client singleton
│   ├── seed.ts            # Script seed data
│   ├── navigation.ts      # Konfigurasi menu + guard role
│   ├── occupancy.ts       # Helper warna okupansi
│   ├── api-response.ts    # Wrapper response API konsisten
│   ├── api-client.ts      # Client helper untuk fetch API
│   ├── pagination.ts      # Helper pagination untuk list endpoint
│   ├── validation.ts      # Schema builder untuk validasi input
│   ├── camp-validation.ts # Validator untuk CampInput
│   ├── distribution.ts    # Logic distribusi antar-posko
│   ├── inventory.ts       # Logic pergerakan stok + reserved
│   ├── audit.ts           # Penulisan log audit
│   └── auth/              # session.ts, guard.ts
├── app/
│   ├── error.tsx          # Global error boundary
│   └── not-found.tsx      # Halaman 404
└── components/
    ├── ui/
    │   ├── button.tsx, card.tsx, badge.tsx, alert.tsx
    │   ├── modal.tsx      # Modal dengan focus trap
    │   ├── form-field.tsx # Form input dengan htmlFor a11y
    │   ├── skeleton.tsx   # Loading skeleton
    │   └── search-input.tsx # Search input + filter util
    └── ...
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

Menu di sidebar dikelompokkan per bagian (**Overview**, **Operasional**, **Data & Informasi**, **Administrasi**). Menu yang belum tersedia ditandai badge **Segera** (non-aktif), dan menu **Pengguna** hanya terlihat oleh Super Admin. Navigasi juga dijaga di sisi server: mengakses halaman tanpa hak akses akan menampilkan layar "Akses ditolak".

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

Sesi berlaku **7 hari** (cookie `siaga_session`). Klik **Keluar** di sidebar untuk logout.

Konfigurasi integrasi Google Sheets memakai environment variable `GOOGLE_SPREADSHEET_ID` dan `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`. Service account harus memiliki akses Editor pada spreadsheet tujuan. Kredensial hanya dipakai di server dan tidak dikirim ke browser.

### 3. Dashboard — `/dashboard`

Menampilkan kartu statistik (posko, kapasitas, okupansi, petugas, logistik kritis, fasilitas rusak, pengungsi) dan daftar seluruh posko.

### 4. Monitoring — `/monitoring`

**Akses: semua role** (data di-scope ke posko sendiri untuk non-Super Admin).

- **Ringkasan**: posko aktif, penghuni, okupansi, logistik bermasalah
- **Peringatan otomatis**: posko hampir penuh (≥90%), stok logistik kritis, fasilitas rusak
- **Status posko**: bar okupansi + jumlah penghuni, logistik bermasalah, dan fasilitas bermasalah per posko

### 5. Peta Bencana — `/peta`

**Akses: semua role** (memakai data yang sama dengan Monitoring).

- Peta Leaflet + OpenStreetMap dengan marker berwarna sesuai okupansi — 🟢 hijau (<70%), 🟠 kuning (70–89%), 🔴 merah (≥90%)
- Klik marker atau daftar posko di samping untuk melihat popup berisi kapasitas, okupansi, logistik bermasalah, dan fasilitas bermasalah

### 6. Kelola Posko — `/kelola-posko`

**Akses tulis: hanya Super Admin.**

- **Tambah**: klik `+ Tambah Posko`, isi nama, alamat, latitude, longitude, dan kapasitas maksimal
- **Detail**: klik nama baris untuk melihat detail
- **Edit**: dari halaman detail, klik `Edit`
- **Toggle Status**: buka/tutup posko (ACTIVE ↔ CLOSED) — posko CLOSED tidak tampil di halaman publik
- **Hapus**: klik `Hapus` pada baris atau di halaman detail

### 7. Logistik — `/logistik`

**Akses tulis: Super Admin atau pengguna divisi LOGISTICS.**

- **Tambah**: pilih posko, isi nama barang, jumlah, unit (kg/dus/box/dll), status, dan catatan
- **Status**: Cukup (SUFFICIENT), Menipis (LOW), Kritis (CRITICAL), Rusak (SPOILED_OR_DAMAGED)
- **Hapus**: klik `Hapus` pada baris

> Pengguna non-Super Admin hanya melihat data logistik posko mereka sendiri.

### 8. Shelter — `/shelter`

**Akses tulis: Super Admin atau pengguna divisi SHELTER.**

- **Tambah**: pilih posko, isi nama fasilitas, status (Baik/Rusak/Dalam Perbaikan), dan deskripsi
- **Hapus**: klik `Hapus` pada baris

### 9. Pengungsi — `/pengungsi`

**Akses tulis: Super Admin atau pengguna divisi DATA_REGISTRATION.**

- **Tambah**: pilih posko, isi nama keluarga, jumlah keluarga, status kebutuhan khusus, dan catatan
  - Sistem otomatis menambah okupansi posko dan **menolak jika kapasitas penuh** (HTTP 409)
- **Check-out**: klik `Check-out` pada baris pengungsi yang masih aktif — okupansi posko otomatis berkurang
- **Hapus**: menghapus data pengungsi aktif juga mengurangi okupansi posko

### 10. Distribusi Logistik — `/distribusi`

**Akses: Super Admin dan pengguna divisi LOGISTICS.**

- Buat permintaan logistik antar posko
- Review permintaan: setujui atau tolak
- Pilih stok sumber saat menyetujui
- Setujui permintaan sekaligus reservasi stok sumber
- Batalkan permintaan berstatus reserved untuk melepas reservasi
- Kirim distribusi dari posko asal
- Terima distribusi di posko tujuan
- Pengiriman mengurangi stok sumber dan penerimaan menambah stok tujuan secara transaksional

### Pergerakan Stok

Stok tidak diubah langsung melalui edit quantity. Gunakan pergerakan stok:

- **Stok masuk** (`RECEIPT`) menambah stok layak
- **Barang rusak** (`DAMAGE`) mengurangi stok tersedia dan menambah total rusak
- **Kehilangan** (`LOSS`) mengurangi stok tersedia dengan alasan wajib
- **Distribusi** memakai reservasi sebelum barang dikirim

Setiap pergerakan menyimpan jumlah, alasan, user, waktu, dan relasi distribusi pada `InventoryMovement`. Data lama dengan status `SPOILED_OR_DAMAGED` tidak dimigrasikan otomatis dan harus diverifikasi manual.

### 11. Laporan — `/laporan`

**Akses: semua role** (data non-Super Admin dibatasi ke posko sendiri).

- Pilih periode laporan
- Lihat ringkasan posko, pengungsi, kapasitas, logistik, fasilitas, dan distribusi
- Export PDF melalui dialog print browser
- Kirim laporan langsung ke Google Sheets dengan format tabel rapi

### 12. Pengaturan — `/pengaturan`

**Akses: semua role.**

- Ubah nama dan email profil
- Ubah password dengan verifikasi password lama
- Super Admin dapat melihat informasi sistem dan status konfigurasi layanan

### 13. Riwayat Aktivitas — `/aktivitas`

**Akses: semua role**. Super Admin melihat seluruh aktivitas, role lain melihat aktivitas akunnya sendiri.

- Login dan logout
- Pembuatan, perubahan, dan penghapusan pengguna
- Aktivitas operasional berikutnya dapat ditambahkan ke audit log yang sama

### 14. Pengguna & Struktur Tim — `/users`

**Akses: hanya Super Admin.**

Struktur organisasi posko:

```text
SUPER_ADMIN
└── MANAGER (1 per posko)
    ├── DIVISION_HEAD — LOGISTICS (1 per divisi/posko)
    │   └── FIELD_OFFICER (banyak)
    ├── DIVISION_HEAD — SHELTER
    │   └── FIELD_OFFICER (banyak)
    └── DIVISION_HEAD — DATA_REGISTRATION
        └── FIELD_OFFICER (banyak)
```

Super Admin menetapkan manager dan ketua divisi melalui struktur tim. Manager mengawasi seluruh divisi poskonya, sedangkan ketua divisi dan Field Officer bekerja sesuai divisinya.

- **Tambah**: nama, email, password, peran (Super Admin/Manager/Field Officer), divisi, dan posko
  - Manager & Field Officer **wajib** memiliki divisi dan posko; Super Admin tidak
- **Edit**: ubah data termasuk reset password (kosongkan jika tidak diubah)
- **Hapus**: tidak bisa menghapus akun sendiri

---

## Matriks Hak Akses

| Aksi | SUPER_ADMIN | MANAGER | DIVISION_HEAD | FIELD_OFFICER |
| --- | --- | --- | --- | --- |
| Kelola posko | ✅ | ❌ | ❌ | ❌ |
| Manajemen pengguna | ✅ | ❌ | ❌ | ❌ |
| Kelola logistik posko | ✅ (semua posko) | ✅ (posko sendiri) | ✅ (LOGISTICS) | ✅ (LOGISTICS) |
| Kelola shelter/fasilitas | ✅ (semua posko) | ✅ (posko sendiri) | ✅ (SHELTER) | ✅ (SHELTER) |
| Kelola pengungsi | ✅ (semua posko) | ✅ (posko sendiri) | ✅ (DATA_REGISTRATION) | ✅ (DATA_REGISTRATION) |
| Kelola distribusi | ✅ | ✅ (posko sendiri) | ✅ (LOGISTICS) | ✅ (LOGISTICS) |
| Lihat dashboard | ✅ | ✅ (posko sendiri) | ✅ (posko sendiri) |
| Monitoring & peta | ✅ | ✅ (posko sendiri) | ✅ (posko sendiri) |

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

> Catatan: seluruh endpoint di bawah membutuhkan sesi login valid. Endpoint publik hanya tersedia di `/api/public/*`.

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
| GET/POST | `/api/distribution` | List / buat permintaan distribusi |
| GET/PUT | `/api/distribution/[id]` | Detail, review, kirim, atau terima distribusi |
| GET | `/api/reports` | Laporan periode: summary, posko, pengungsi, logistik, fasilitas, distribusi (scoped) |
| POST | `/api/reports/sheets` | Kirim laporan periode ke Google Sheets dalam tabel terformat (scoped) |
| GET | `/api/monitoring` | Monitoring: summary + peringatan + status posko (scoped) |

---

## Model Database

- **User** — akun dengan peran `SUPER_ADMIN` | `MANAGER` | `DIVISION_HEAD` | `FIELD_OFFICER` dan divisi `LOGISTICS` | `SHELTER` | `DATA_REGISTRATION`
- **CampDivisionHead** — satu ketua untuk setiap kombinasi posko dan divisi
- **Camp** — posko: lokasi (lat/lng), kapasitas, okupansi, status `ACTIVE` | `CLOSED`
- **LogisticsItem** — item logistik per posko dengan status ketersediaan
- **FacilityReport** — laporan kondisi fasilitas per posko
- **AuditLog** — riwayat aktivitas user dan aksi sistem
- **LogisticsRequest** — permintaan logistik antar posko dengan status review
- **Distribution** — pengiriman dan penerimaan logistik yang terhubung ke stok sumber
- **EvacueeRecord** — data pengungsi per posko (registrasi & check-out)
- **Session** — sesi login (hash token, kedaluwarsa 7 hari)

Relasi: `User` → `Camp` (SetNull), sedangkan `LogisticsItem`, `FacilityReport`, dan `EvacueeRecord` → `Camp` (Cascade — ikut terhapus saat posko dihapus).

---

## Catatan Teknis

- **Root redirect**: `src/app/page.tsx` me-redirect `/` → `/public` di sisi server sebelum React dirender
- **Guard**: route dashboard dijaga `AuthGuard` (client) + API mengembalikan 401 tanpa sesi
- **Peta**: hanya dirender di client (`ssr: false`) karena Leaflet membutuhkan `window`
- **Data publik**: endpoint publik tidak pernah mengekspos nama pengungsi, email, atau data pribadi — hanya agregat okupansi dan kondisi operasional

---

## Role & Permission Matrix

| Fitur | SUPER_ADMIN | MANAGER | DIVISION_HEAD | FIELD_OFFICER |
| --- | :---: | :---: | :---: | :---: |
| Dashboard / Monitoring / Laporan | ✓ (semua posko) | ✓ (posko sendiri) | ✓ (posko sendiri) | ✓ (posko sendiri) |
| Kelola Posko (CRUD) | ✓ | ✗ | ✗ | ✗ |
| Assign Manager / Division Head | ✓ | ✗ | ✗ | ✗ |
| Logistik (CRUD + pergerakan) | ✓ | ✓ (camp sendiri) | ✓ (divisi LOGISTICS) | ✓ (divisi LOGISTICS) |
| Distribusi (request/approve/ship/receive) | ✓ | ✓ (camp sendiri) | ✓ (divisi LOGISTICS) | ✓ (divisi LOGISTICS) |
| Shelter / Facility Report | ✓ | ✓ (camp sendiri) | ✓ (divisi SHELTER) | ✓ (divisi SHELTER) |
| Pengungsi (CRUD + check-out) | ✓ | ✓ (camp sendiri) | ✓ (divisi DATA_REGISTRATION) | ✓ (divisi DATA_REGISTRATION) |
| Manajemen Pengguna (CRUD) | ✓ | ✓ (tim sendiri, non-admin) | ✗ | ✗ |
| Pengaturan Akun | ✓ | ✓ | ✓ | ✓ |
| Riwayat Aktivitas | ✓ (semua) | ✓ (camp sendiri) | ✓ (camp sendiri) | ✓ (camp sendiri) |
| Lihat Halaman Publik | ✓ | ✓ | ✓ | ✓ |

Hierarki: `SUPER_ADMIN → MANAGER → DIVISION_HEAD → FIELD_OFFICER`. Tiap manager memimpin satu posko, satu divisi memiliki satu ketua.

---

## Alur Bisnis Inti

### Distribusi Logistik

```
PENDING ──APPROVE──▶ APPROVED ──RESERVE──▶ RESERVED ──SHIP──▶ SHIPPED ──RECEIVE──▶ RECEIVED
   │                                                  │
   └──────REJECT──▶ REJECTED  └────────CANCEL─────────┘
```

- **PENDING** dibuat oleh logistik posko tujuan (`/api/distribution` POST).
- **APPROVE** oleh logistik posko asal: pilih sumber item + jumlah (jumlah ≤ permintaan). Stok sumber di-*reserve* (jumlah ditambahkan ke `reservedQuantity`).
- **SHIP** oleh logistik posko asal: stok sumber berkurang (sekaligus reservasi dilepas), distribusi berstatus `SHIPPED`.
- **RECEIVE** oleh logistik posko tujuan: stok tujuan bertambah dengan item sumber (atau buat baru jika belum ada).
- **CANCEL** selama `RESERVED` akan melepas reservasi. Stok sumber tidak berubah.
- **REJECT** hanya saat `PENDING`. Stok sumber tidak berubah.

### Inventory Movement

Tipe pergerakan (`InventoryMovementType`):
- `RECEIPT` — stok masuk dari supplier/donasi (menambah `quantity`)
- `DAMAGE` — barang rusak (mengurangi `quantity`, menambah `damagedQuantity`, **wajib ada reason**)
- `LOSS` — barang hilang (mengurangi `quantity`, **wajib ada reason**)
- `RESTORE` — pemulihan barang rusak (mengurangi `damagedQuantity`, menambah `quantity`, **wajib ada reason**, **jumlah ≤ damagedQuantity**)
- `RESERVATION` / `RESERVATION_RELEASE` — otomatis saat alur distribusi
- `DISTRIBUTION_OUT` / `DISTRIBUTION_IN` — otomatis saat stok keluar/masuk posko

Status operasional `LogisticsItem` dihitung otomatis oleh `refreshOperationalStatus`:
- `SPOILED_OR_DAMAGED` dipertahankan apapun kondisinya (kecuali `RESTORE` mengembalikan ke usable)
- Jika `quantity - reservedQuantity ≤ 0` → `CRITICAL`
- Jika `quantity - reservedQuantity ≤ minimumQuantity` → `LOW`
- Lainnya → `SUFFICIENT`

### Okupansi Posko

- `Camp.currentOccupants` adalah denormalisasi dari `SUM(EvacueeRecord.totalFamily WHERE departedAt IS NULL)`.
- Increment saat POST `/api/evacuees`, decrement saat checkout atau delete (jika belum checkout).
- Defensive check: `Camp.currentOccupants` tidak boleh negatif; checkout/delete akan return 409 jika state tidak konsisten.

---

## Standar & Konvensi

- **Response API**: selalu `{ success: boolean, data?, message?, pagination? }`. Pakai helper `src/lib/api-response.ts` (`ok`, `fail`, `unauthorized`, `forbidden`, `notFound`).
- **Validasi input**: pakai `src/lib/validation.ts` (`v.string`, `v.int`, `v.float`, `v.enum`, `object`) atau schema khusus seperti `parseCampInput`.
- **Pagination**: list endpoint mengembalikan `{ data, pagination: { page, limit, total, totalPages } }` lewat `src/lib/pagination.ts`.
- **Client API**: pakai `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete` dari `src/lib/api-client.ts` agar error handling seragam.
- **Aksesibilitas**: `FormField`/`FormSelect` punya `htmlFor`+`id`+`aria-invalid`+`aria-describedby`. `Modal` punya focus trap + `aria-modal` + Escape-to-close.
- **Audit log**: tulis lewat `writeAuditLog({ userId, action, entity, entityId, details })` di `src/lib/audit.ts`. `details` akan di-JSON-stringify otomatis.
