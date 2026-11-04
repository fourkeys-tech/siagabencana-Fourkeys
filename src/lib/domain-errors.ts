// Satu sumber pesan untuk kode error domain yang dilempar sebagai `new Error("KODE")`.
// Kode tetap menjadi Error.message (dipakai test & alur), status + pesan dipetakan di sini.
// Tanpa import @prisma/client supaya aman dipakai di client component.

export const SERIALIZATION_CONFLICT_MESSAGE = "Data sedang diperbarui pengguna lain. Silakan coba lagi.";

export const DOMAIN_ERRORS = {
	// Stok & pergerakan
	INVALID_QUANTITY: { status: 400, message: "Jumlah harus bilangan bulat lebih dari 0." },
	MOVEMENT_REASON_REQUIRED: { status: 400, message: "Alasan wajib diisi." },
	INSUFFICIENT_AVAILABLE_STOCK: { status: 409, message: "Stok tersedia tidak mencukupi." },
	LOGISTICS_ITEM_NOT_FOUND: { status: 404, message: "Data logistik tidak ditemukan." },
	RESTORE_QUANTITY_EXCEEDS_DAMAGED: { status: 409, message: "Jumlah pemulihan melebihi jumlah barang rusak yang tercatat." },
	DISPOSE_QUANTITY_EXCEEDS_DAMAGED: { status: 409, message: "Jumlah yang dikeluarkan melebihi jumlah barang rusak yang tercatat." },

	// Distribusi
	DISTRIBUTION_NOT_FOUND: { status: 404, message: "Distribusi tidak ditemukan." },
	DISTRIBUTION_REQUEST_NOT_FOUND: { status: 404, message: "Permintaan distribusi tidak ditemukan." },
	INVALID_DISTRIBUTION_STATUS: { status: 409, message: "Status distribusi sudah berubah atau aksi tidak sesuai alur." },
	INVALID_REQUEST_STATUS: { status: 409, message: "Permintaan sudah diproses." },
	SOURCE_STOCK_NOT_FOUND: { status: 409, message: "Stok sumber tidak tersedia." },
	SOURCE_STOCK_MISMATCH: { status: 400, message: "Barang sumber tidak cocok dengan permintaan atau sedang rusak." },
	RESERVATION_NOT_FOUND: { status: 409, message: "Reservasi stok tidak ditemukan." },
	QUANTITY_EXCEEDS_REQUEST: { status: 400, message: "Jumlah distribusi melebihi permintaan." },

	// Konversi unit
	CONVERSION_REQUIRED: { status: 400, message: "Isi kemasan belum didefinisikan. Lengkapi faktor konversi terlebih dahulu." },
	CONVERSION_NOT_EXACT: { status: 400, message: "Jumlah tidak dapat dikonversi tepat ke unit stok." },
	CONVERSION_OVERFLOW: { status: 400, message: "Hasil konversi terlalu besar." },
	CONVERSION_DEFINITION_REQUIRED: { status: 400, message: "Definisi konversi wajib diisi untuk unit berbeda." },
	INVALID_CONVERSION_FACTOR: { status: 400, message: "Faktor konversi harus bilangan bulat positif." },
	UNIT_CONVERSION_NOT_SUPPORTED: { status: 400, message: "Unit permintaan tidak memiliki definisi konversi yang aman." },
	BASE_UNIT_DIMENSION_MISMATCH: { status: 400, message: "Unit dasar tidak sesuai dengan dimensi barang." },
	UNIT_REQUIRED: { status: 400, message: "Unit dan unit dasar wajib diisi." },
	UNIT_NOT_SUPPORTED: { status: 400, message: "Unit tidak tersedia di katalog unit." },
	STANDARD_UNIT_MISMATCH: { status: 400, message: "Unit standar memakai definisi resmi (kg = 1000 g, l = 1000 ml, pcs/unit/g/ml = 1) dan tidak dapat diubah." },
	UNIT_LOCKED_BY_STOCK: { status: 409, message: "Definisi unit tidak dapat diubah saat stok, reservasi, atau stok rusak masih tercatat. Barang kemasan yang belum diverifikasi dapat memakai Verifikasi isi kemasan; selain itu kosongkan saldo melalui pergerakan stok terlebih dahulu." },
	UNIT_VERIFY_BLOCKED: { status: 409, message: "Isi kemasan tidak dapat diverifikasi saat stok dicadangkan atau masih ada permintaan/distribusi berjalan untuk barang ini. Selesaikan atau batalkan terlebih dahulu." },

	// Posko & pengungsi
	CAMP_NOT_FOUND: { status: 404, message: "Posko tidak ditemukan." },
	CAMP_NOT_ACTIVE: { status: 409, message: "Posko sudah ditutup sehingga tidak dapat menerima operasi baru." },
	CAMP_FULL: { status: 409, message: "Kapasitas posko sudah tidak mencukupi." },
	CAMP_HAS_ACTIVE_EVACUEES: { status: 409, message: "Posko masih memiliki pengungsi aktif. Lakukan check-out seluruh pengungsi sebelum menutup posko." },
	CAMP_HAS_ACTIVE_DISTRIBUTIONS: { status: 409, message: "Posko masih memiliki pengiriman distribusi yang sedang berlangsung. Selesaikan atau batalkan distribusi terlebih dahulu." },
	INVALID_CAMP_OCCUPANCY: { status: 409, message: "Jumlah pengungsi tercatat di posko tidak sesuai. Muat ulang data lalu coba lagi." },
	EVACUEE_NOT_FOUND: { status: 404, message: "Data pengungsi tidak ditemukan." },
	ALREADY_CHECKED_OUT: { status: 409, message: "Pengungsi sudah check-out." },

	// User & penugasan
	CAMP_MANAGER_EXISTS: { status: 409, message: "Posko tersebut sudah memiliki manager." },
	DIVISION_HEAD_EXISTS: { status: 409, message: "Divisi tersebut sudah memiliki ketua di posko ini." },
	INVALID_MANAGER_ASSIGNMENT: { status: 400, message: "Pilih akun Manager yang sudah ditugaskan ke posko ini." },

	// Transaksi
	P2034_EXHAUSTED: { status: 409, message: SERIALIZATION_CONFLICT_MESSAGE },
} as const satisfies Record<string, { status: number; message: string }>;

export type DomainErrorCode = keyof typeof DOMAIN_ERRORS;

export function isDomainErrorCode(code: string): code is DomainErrorCode {
	return Object.hasOwn(DOMAIN_ERRORS, code);
}

/** Status + pesan untuk error domain, atau null bila bukan kode yang dikenal. */
export function domainError(error: unknown): { status: number; message: string } | null {
	if (!(error instanceof Error) || !isDomainErrorCode(error.message)) return null;
	return DOMAIN_ERRORS[error.message];
}
