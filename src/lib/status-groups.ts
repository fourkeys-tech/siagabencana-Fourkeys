import type { FacilityStatus, ItemStatus } from "@prisma/client";

// Satu sumber definisi status agar dashboard, monitoring, laporan, dan halaman publik konsisten.

// Logistik yang perlu perhatian (stok menipis, kritis, atau rusak).
export const PROBLEM_LOGISTICS_STATUSES: ItemStatus[] = ["LOW", "CRITICAL", "SPOILED_OR_DAMAGED"];

// Logistik yang perlu tindakan segera.
export const CRITICAL_LOGISTICS_STATUSES: ItemStatus[] = ["CRITICAL", "SPOILED_OR_DAMAGED"];

// Fasilitas yang belum berfungsi normal.
export const PROBLEM_FACILITY_STATUSES: FacilityStatus[] = ["DAMAGED", "REPAIRING"];

// Fasilitas rusak yang belum ditangani.
export const DAMAGED_FACILITY_STATUSES: FacilityStatus[] = ["DAMAGED"];

// Ambang okupansi posko dianggap hampir penuh.
export const NEAR_FULL_OCCUPANCY_PERCENTAGE = 90;
