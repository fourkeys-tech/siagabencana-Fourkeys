import { describe, expect, it } from "vitest";
import { parseSpreadsheetId, sheetsErrorInfo, spreadsheetUrl } from "@/lib/spreadsheet";

const ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";

describe("parseSpreadsheetId", () => {
	it("mengambil ID dari berbagai bentuk URL Google Sheets", () => {
		expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`)).toBe(ID);
		expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`)).toBe(ID);
		expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/u/1/d/${ID}/edit`)).toBe(ID);
		expect(parseSpreadsheetId(`docs.google.com/spreadsheets/d/${ID}`)).toBe(ID);
		expect(parseSpreadsheetId(`  ${ID}  `)).toBe(ID);
	});

	it("menolak input yang bukan spreadsheet", () => {
		expect(parseSpreadsheetId("")).toBeNull();
		expect(parseSpreadsheetId("   ")).toBeNull();
		expect(parseSpreadsheetId(null)).toBeNull();
		expect(parseSpreadsheetId(123)).toBeNull();
		expect(parseSpreadsheetId("pendek")).toBeNull();
		expect(parseSpreadsheetId("https://example.com/halaman")).toBeNull();
		expect(parseSpreadsheetId(`${ID}/../evil`)).toBeNull();
		// URL "Publikasikan ke web" bukan ID dokumen yang bisa ditulisi.
		expect(parseSpreadsheetId("https://docs.google.com/spreadsheets/d/e/2PACX-1vQabcdefghijklmnopqrstuvwxyz/pubhtml")).toBeNull();
	});
});

describe("spreadsheetUrl", () => {
	it("membangun URL edit dengan/atau tanpa gid", () => {
		expect(spreadsheetUrl(ID)).toBe(`https://docs.google.com/spreadsheets/d/${ID}/edit`);
		expect(spreadsheetUrl(ID, 0)).toBe(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`);
	});
});

describe("sheetsErrorInfo", () => {
	const googleError = (status: number, message = "error") => Object.assign(new Error(message), { status });

	it("403 → minta share ke email service account", () => {
		const info = sheetsErrorInfo(googleError(403, "The caller does not have permission"), "bot@proj.iam.gserviceaccount.com");
		expect(info?.status).toBe(400);
		expect(info?.message).toContain("bot@proj.iam.gserviceaccount.com");
		expect(info?.message).toContain("Editor");
	});

	it("403 API belum aktif dibedakan dari masalah share", () => {
		const info = sheetsErrorInfo(googleError(403, "Google Sheets API has not been used in project 123"));
		expect(info?.status).toBe(503);
		expect(info?.message).toMatch(/belum diaktifkan/);
	});

	it("404, file Excel, 429, dan kredensial rusak dipetakan", () => {
		expect(sheetsErrorInfo(googleError(404))?.message).toMatch(/tidak ditemukan/);
		expect(sheetsErrorInfo(googleError(400, "This operation is not supported for this document"))?.message).toMatch(/bukan Google Sheets/);
		expect(sheetsErrorInfo(googleError(429))?.status).toBe(429);
		expect(sheetsErrorInfo(new Error("GOOGLE_SERVICE_ACCOUNT_INVALID"))?.status).toBe(503);
		expect(sheetsErrorInfo(new Error("GOOGLE_SERVICE_ACCOUNT_NOT_CONFIGURED"))?.status).toBe(503);
		expect(sheetsErrorInfo(new Error("invalid_grant: account not found"))?.status).toBe(503);
	});

	it("status dari response.status (bentuk GaxiosError) juga dikenali", () => {
		const error = Object.assign(new Error("Requested entity was not found."), { response: { status: 404 } });
		expect(sheetsErrorInfo(error)?.status).toBe(400);
	});

	it("error non-Google → null (diteruskan ke handler umum)", () => {
		expect(sheetsErrorInfo(new Error("koneksi DB putus"))).toBeNull();
		expect(sheetsErrorInfo(googleError(500))).toBeNull();
		expect(sheetsErrorInfo(null)).toBeNull();
	});
});
