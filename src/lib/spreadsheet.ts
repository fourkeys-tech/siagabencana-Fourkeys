// Helper murni (tanpa googleapis/server-only) supaya bisa diuji unit dan dipakai route.

const RAW_ID = /^[A-Za-z0-9_-]{20,100}$/;
const URL_ID = /\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/;

/**
 * Terima URL Google Sheets lengkap atau ID mentah, kembalikan ID-nya.
 * Null bila format tidak dikenali (termasuk URL "Publikasikan ke web" /d/e/...).
 */
export function parseSpreadsheetId(input: unknown): string | null {
	if (typeof input !== "string") return null;
	const value = input.trim();
	if (!value) return null;

	const fromUrl = value.match(URL_ID)?.[1];
	const candidate = fromUrl ?? value;
	return RAW_ID.test(candidate) ? candidate : null;
}

export function spreadsheetUrl(spreadsheetId: string, sheetId?: number) {
	const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
	return sheetId === undefined ? base : `${base}#gid=${sheetId}`;
}

type SheetsErrorInfo = { status: number; message: string };

function httpStatus(error: unknown): number | null {
	if (!error || typeof error !== "object") return null;
	const candidate = error as { status?: unknown; code?: unknown; response?: { status?: unknown } };
	for (const value of [candidate.status, candidate.response?.status, candidate.code]) {
		if (typeof value === "number") return value;
	}
	return null;
}

/**
 * Terjemahkan error Google Sheets API ke pesan yang bisa ditindaklanjuti user.
 * Null bila bukan error Google (biarkan handler umum yang menangani).
 */
export function sheetsErrorInfo(error: unknown, serviceAccountEmail?: string | null): SheetsErrorInfo | null {
	const message = error instanceof Error ? error.message : "";

	if (message === "GOOGLE_SERVICE_ACCOUNT_NOT_CONFIGURED") {
		return { status: 503, message: "Service account Google belum dikonfigurasi di server. Hubungi administrator." };
	}
	if (message === "GOOGLE_SERVICE_ACCOUNT_INVALID" || /invalid_grant|invalid_client|DECODER|private key/i.test(message)) {
		return { status: 503, message: "Kredensial service account Google di server tidak valid. Hubungi administrator." };
	}

	const status = httpStatus(error);
	if (status === null) return null;

	if (status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(message)) {
		return { status: 503, message: "Google Sheets API belum diaktifkan di project Google Cloud milik service account. Hubungi administrator." };
	}
	if (status === 403) {
		const target = serviceAccountEmail ? ` ke ${serviceAccountEmail}` : " ke email service account";
		return { status: 400, message: `Akses ke spreadsheet ditolak. Bagikan spreadsheet${target} dengan peran Editor, lalu coba lagi.` };
	}
	if (status === 404) {
		return { status: 400, message: "Spreadsheet tidak ditemukan. Periksa kembali URL/ID spreadsheet di Pengaturan." };
	}
	if (status === 400 && /not supported for this document/i.test(message)) {
		return { status: 400, message: "Dokumen tersebut bukan Google Sheets asli (mis. file Excel). Buka file lalu pilih File → Simpan sebagai Google Spreadsheet." };
	}
	if (status === 401) {
		return { status: 503, message: "Kredensial service account Google di server tidak valid. Hubungi administrator." };
	}
	if (status === 429) {
		return { status: 429, message: "Kuota Google Sheets API sedang penuh. Coba lagi dalam beberapa menit." };
	}
	return null;
}
