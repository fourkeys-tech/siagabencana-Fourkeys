-- Spreadsheet tujuan ekspor laporan diatur per akun, menggantikan GOOGLE_SPREADSHEET_ID di env.
-- Kolom nullable tanpa default: aman untuk tabel berisi data (tidak ada rewrite/backfill).
ALTER TABLE "User" ADD COLUMN "reportSpreadsheetId" TEXT;
