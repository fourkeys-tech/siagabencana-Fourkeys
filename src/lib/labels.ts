const LABELS: Record<string, string> = {
	// Roles
	SUPER_ADMIN: "Super Admin",
	MANAGER: "Manager Posko",
	DIVISION_HEAD: "Ketua Divisi",
	FIELD_OFFICER: "Petugas Lapangan",

	// Divisions
	LOGISTICS: "Logistik",
	SHELTER: "Shelter & Fasilitas",
	DATA_REGISTRATION: "Pendataan Pengungsi",

	// Camp Status
	ACTIVE: "Aktif",
	CLOSED: "Ditutup",

	// Item Status
	SUFFICIENT: "Aman",
	LOW: "Menipis",
	CRITICAL: "Kritis",
	SPOILED_OR_DAMAGED: "Rusak",

	// Facility Status
	GOOD: "Baik",
	DAMAGED: "Rusak",
	REPAIRING: "Dalam Perbaikan",

	// Distribution Status
	PENDING: "Menunggu",
	APPROVED: "Disetujui",
	RESERVED: "Dicadangkan",
	REJECTED: "Ditolak",
	SHIPPED: "Dalam Pengiriman",
	RECEIVED: "Diterima",
	CANCELLED: "Dibatalkan",

	// Movement Types
	RECEIPT: "Stok Masuk",
	DAMAGE: "Barang Rusak",
	LOSS: "Kehilangan",
	RESTORE: "Pemulihan",
	DISPOSE: "Dibuang",
	RESERVATION: "Pencadangan",
	RESERVATION_RELEASE: "Pelepasan Cadangan",
	DISTRIBUTION_OUT: "Distribusi Keluar",
	DISTRIBUTION_IN: "Distribusi Masuk",

	// Availability
	AVAILABLE: "Tersedia",
	LIMITED: "Terbatas",
	FULL: "Penuh",

	// Audit Log Actions
	STOCK_RECEIPT: "Penerimaan Stok",
	STOCK_DAMAGE: "Pencatatan Rusak",
	STOCK_LOSS: "Pencatatan Hilang",
	STOCK_RESTORE: "Pemulihan Stok",
	STOCK_DISPOSE: "Pemusnahan Stok",
	FACILITY_REPORT_DAMAGE: "Lapor Fasilitas Rusak",
	FACILITY_START_REPAIR: "Mulai Perbaikan",
	FACILITY_COMPLETE_REPAIR: "Selesai Perbaikan",
	FACILITY_MARK_REPLACEMENT: "Tandai Perlu Penggantian",
	ASSIGN_MANAGER: "Tetapkan Manager",
	UNASSIGN_MANAGER: "Lepas Manager",
	ASSIGN_DIVISION_HEAD: "Tetapkan Ketua Divisi",
	UNASSIGN_DIVISION_HEAD: "Lepas Ketua Divisi",
};

export function enumLabel(value: string | null | undefined, fallback?: string): string {
	if (!value) return fallback ?? "-";
	return LABELS[value] ?? fallback ?? value;
}
