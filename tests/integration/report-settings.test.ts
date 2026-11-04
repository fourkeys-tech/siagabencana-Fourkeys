import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as getSettings, PUT as putSettings } from "@/app/api/settings/reports/route";
import { POST as exportSheets } from "@/app/api/reports/sheets/route";
import { GET as getReports } from "@/app/api/reports/route";
import { createUser, describeDb, resetDatabase } from "./helpers";

const currentUser = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => currentUser.value }));

// Google API tidak dipanggil sungguhan; perilakunya diatur per test.
const google = vi.hoisted(() => ({
	verify: vi.fn(),
	write: vi.fn(),
}));
vi.mock("@/lib/google-sheets", () => ({
	getServiceAccountEmail: () => "bot@proyek.iam.gserviceaccount.com",
	verifySpreadsheetAccess: google.verify,
	writeReportToGoogleSheet: google.write,
}));

const ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";
const URL_INPUT = `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`;

const put = (spreadsheet: unknown) =>
	putSettings(new Request("http://localhost/api/settings/reports", {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ spreadsheet }),
	}));

async function read(response: Response) {
	return { status: response.status, ...(await response.json()) as { success: boolean; message?: string; data?: Record<string, unknown> } };
}

describeDb("pengaturan spreadsheet laporan per akun", () => {
	beforeEach(async () => {
		await resetDatabase();
		vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64", "dummy-base64");
		google.verify.mockReset().mockResolvedValue({ title: "Laporan Posko", spreadsheetUrl: "" });
		google.write.mockReset().mockResolvedValue({ spreadsheetId: ID, sheetTitle: "Laporan", sheetId: 7, spreadsheetUrl: "", rows: 10 });
	});

	afterEach(() => vi.unstubAllEnvs());
	afterAll(async () => prisma.$disconnect());

	it("hanya Super Admin & Manager; role lain 403", async () => {
		currentUser.value = await createUser({ role: "FIELD_OFFICER", division: "LOGISTICS" });
		expect((await getSettings()).status).toBe(403);
		expect((await put(URL_INPUT)).status).toBe(403);
	});

	it("URL disimpan sebagai ID setelah akses diverifikasi; tiap akun terpisah", async () => {
		const manager = await createUser({ role: "MANAGER" });
		const admin = await createUser({ role: "SUPER_ADMIN" });

		currentUser.value = manager;
		const saved = await read(await put(URL_INPUT));
		expect(saved).toMatchObject({ status: 200, success: true });
		expect(saved.message).toContain("Laporan Posko");
		expect(saved.data).toMatchObject({ spreadsheetId: ID, serviceAccountEmail: "bot@proyek.iam.gserviceaccount.com" });
		expect(google.verify).toHaveBeenCalledWith(ID);

		expect((await prisma.user.findUniqueOrThrow({ where: { id: manager.id } })).reportSpreadsheetId).toBe(ID);
		expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).reportSpreadsheetId).toBeNull();

		currentUser.value = admin;
		expect((await read(await getSettings())).data?.spreadsheetId).toBeNull();
	});

	it("input tidak valid → 400; spreadsheet belum di-share → 400 berisi email service account, tidak tersimpan", async () => {
		const manager = await createUser({ role: "MANAGER" });
		currentUser.value = manager;

		expect((await put("https://example.com/bukan-sheet")).status).toBe(400);

		google.verify.mockRejectedValueOnce(Object.assign(new Error("The caller does not have permission"), { status: 403 }));
		const denied = await read(await put(URL_INPUT));
		expect(denied.status).toBe(400);
		expect(denied.message).toContain("bot@proyek.iam.gserviceaccount.com");
		expect((await prisma.user.findUniqueOrThrow({ where: { id: manager.id } })).reportSpreadsheetId).toBeNull();
	});

	it("string kosong menghapus spreadsheet; tanpa service account tetap tersimpan tanpa verifikasi", async () => {
		const admin = await createUser({ role: "SUPER_ADMIN" });
		currentUser.value = admin;

		vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64", "");
		const unverified = await read(await put(ID));
		expect(unverified.status).toBe(200);
		expect(unverified.data).toMatchObject({ spreadsheetId: ID, serviceAccountConfigured: false });
		expect(google.verify).not.toHaveBeenCalled();

		const cleared = await read(await put(""));
		expect(cleared.status).toBe(200);
		expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).reportSpreadsheetId).toBeNull();
	});

	it("ekspor memakai spreadsheet milik akun; belum diatur → 400", async () => {
		const manager = await createUser({ role: "MANAGER" });
		currentUser.value = manager;
		const exportRequest = () => exportSheets(new Request("http://localhost/api/reports/sheets", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ from: "2026-11-01", to: "2026-11-04" }),
		}));

		const missing = await read(await exportRequest());
		expect(missing.status).toBe(400);
		expect(missing.message).toMatch(/Pengaturan/);
		expect(google.write).not.toHaveBeenCalled();

		await prisma.user.update({ where: { id: manager.id }, data: { reportSpreadsheetId: ID } });
		expect((await exportRequest()).status).toBe(200);
		expect(google.write.mock.calls[0]?.[0]).toBe(ID);
	});

	it("GET /api/reports melaporkan status Sheets per akun; null untuk role tanpa akses ekspor", async () => {
		const manager = await createUser({ role: "MANAGER" });
		currentUser.value = manager;
		const status = async () => (await read(await getReports(new Request("http://localhost/api/reports?from=2026-11-01&to=2026-11-04")))).data?.sheets;

		expect(await status()).toEqual({ serviceAccountConfigured: true, spreadsheetConfigured: false });
		await prisma.user.update({ where: { id: manager.id }, data: { reportSpreadsheetId: ID } });
		expect(await status()).toEqual({ serviceAccountConfigured: true, spreadsheetConfigured: true });

		currentUser.value = await createUser({ role: "FIELD_OFFICER", division: "LOGISTICS" });
		expect(await status()).toBeNull();
	});
});
