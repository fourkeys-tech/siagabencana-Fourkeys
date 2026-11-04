import "server-only";
import { google, sheets_v4 } from "googleapis";
import { spreadsheetUrl } from "@/lib/spreadsheet";

// Hanya kredensial service account yang berasal dari env (sekali per server).
// Spreadsheet tujuan diatur per akun (User.reportSpreadsheetId).
type ServiceAccountCredentials = { client_email: string; private_key: string };

function getCredentials(): ServiceAccountCredentials {
	const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
	if (!encoded) throw new Error("GOOGLE_SERVICE_ACCOUNT_NOT_CONFIGURED");

	try {
		const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Partial<ServiceAccountCredentials>;
		if (!parsed.client_email || !parsed.private_key) throw new Error("missing fields");
		return { client_email: parsed.client_email, private_key: parsed.private_key };
	} catch {
		throw new Error("GOOGLE_SERVICE_ACCOUNT_INVALID");
	}
}

/** Email service account (bukan rahasia) yang harus diberi akses Editor oleh user. */
export function getServiceAccountEmail(): string | null {
	try {
		return getCredentials().client_email;
	} catch {
		return null;
	}
}

function getSheetsClient() {
	const auth = new google.auth.GoogleAuth({
		credentials: getCredentials(),
		scopes: ["https://www.googleapis.com/auth/spreadsheets"],
	});
	return google.sheets({ version: "v4", auth });
}

/**
 * Pastikan service account bisa MENULIS ke spreadsheet: baca judul lalu tulis ulang judul yang sama
 * (no-op, tapi butuh peran Editor). Error Google dilempar apa adanya untuk dipetakan oleh sheetsErrorInfo.
 */
export async function verifySpreadsheetAccess(spreadsheetId: string) {
	const sheets = getSheetsClient();
	const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title" });
	const title = metadata.data.properties?.title ?? "Spreadsheet";

	await sheets.spreadsheets.batchUpdate({
		spreadsheetId,
		requestBody: {
			requests: [{ updateSpreadsheetProperties: { properties: { title }, fields: "title" } }],
		},
	});

	return { title, spreadsheetUrl: spreadsheetUrl(spreadsheetId) };
}

export type ReportSheetRow = Array<string | number>;

export type ReportSheetLayout = {
	tabTitle?: string;
	sectionRows: number[];
	headerRows: number[];
	columnCount: number;
};

type SheetsBatchRequest = sheets_v4.Schema$Request;

function columnLetter(columnIndex: number) {
	let value = "";
	let index = columnIndex + 1;

	while (index > 0) {
		const remainder = (index - 1) % 26;
		value = String.fromCharCode(65 + remainder) + value;
		index = Math.floor((index - 1) / 26);
	}

	return value;
}

function sanitizeSheetTitle(title: string): string {
	const clean = title.replace(/[:\\/?*[\]']/g, "-").replace(/\s+/g, " ").trim();
	return clean.slice(0, 90) || "Laporan";
}

function makeUniqueTitle(base: string, existing: Set<string>): string {
	const sanitized = sanitizeSheetTitle(base);
	if (!existing.has(sanitized)) return sanitized;
	let index = 1;
	while (existing.has(`${sanitized} (${index})`)) {
		index += 1;
	}
	return `${sanitized} (${index})`;
}

export async function writeReportToGoogleSheet(
	id: string,
	rows: ReportSheetRow[],
	title: string,
	layout: ReportSheetLayout,
) {
	const sheets = getSheetsClient();
	const metadata = await sheets.spreadsheets.get({
		spreadsheetId: id,
		fields: "sheets.properties.title",
	});

	const existingTitles = new Set(
		(metadata.data.sheets ?? []).map((s) => s.properties?.title).filter((t): t is string => Boolean(t)),
	);
	const uniqueTabTitle = makeUniqueTitle(layout.tabTitle ?? title, existingTitles);

	// Selalu tab baru per export: riwayat export lama dan tab milik user tidak pernah ditimpa.
	// Tidak ada fallback ke tab yang sudah ada karena spreadsheet ini milik pribadi user.
	const addSheetRes = await sheets.spreadsheets.batchUpdate({
		spreadsheetId: id,
		requestBody: {
			requests: [{ addSheet: { properties: { title: uniqueTabTitle } } }],
		},
	});
	const created = addSheetRes.data.replies?.[0]?.addSheet?.properties;
	if (created?.sheetId === undefined || created.sheetId === null || !created.title) {
		throw new Error("Gagal membuat tab baru di Google Sheets");
	}
	const targetSheetId = created.sheetId;
	const targetSheetTitle = created.title;

	const lastColumn = columnLetter(Math.max(layout.columnCount - 1, 0));
	const lastRow = Math.max(rows.length + 1, 1);
	const escapedTitle = targetSheetTitle.replace(/'/g, "''");
	const range = `'${escapedTitle}'!A1:${lastColumn}${lastRow}`;

	await sheets.spreadsheets.values.update({
		spreadsheetId: id,
		range,
		valueInputOption: "USER_ENTERED",
		requestBody: {
			values: [[title], ...rows],
		},
	});

	const titleRow = 0;
	const periodRow = 1;
	const requests: SheetsBatchRequest[] = [
		{
			repeatCell: {
				range: {
					sheetId: targetSheetId,
					startRowIndex: 0,
					endRowIndex: lastRow + 1,
					startColumnIndex: 0,
					endColumnIndex: layout.columnCount,
				},
				cell: {
					userEnteredFormat: {
						backgroundColor: { red: 1, green: 1, blue: 1 },
						textFormat: { foregroundColor: { red: 0.12, green: 0.16, blue: 0.22 }, fontFamily: "Arial", fontSize: 10 },
						verticalAlignment: "MIDDLE",
						wrapStrategy: "WRAP",
					},
				},
				fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)",
			},
		},
		{
			repeatCell: {
				range: { sheetId: targetSheetId, startRowIndex: titleRow, endRowIndex: titleRow + 1, startColumnIndex: 0, endColumnIndex: layout.columnCount },
				cell: {
					userEnteredFormat: {
						backgroundColor: { red: 0.05, green: 0.25, blue: 0.48 },
						textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontFamily: "Arial", fontSize: 16 },
						horizontalAlignment: "CENTER",
					},
				},
				fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
			},
		},
		{
			repeatCell: {
				range: { sheetId: targetSheetId, startRowIndex: periodRow, endRowIndex: periodRow + 1, startColumnIndex: 0, endColumnIndex: layout.columnCount },
				cell: {
					userEnteredFormat: {
						backgroundColor: { red: 0.88, green: 0.93, blue: 0.98 },
						textFormat: { bold: true, fontFamily: "Arial", fontSize: 10 },
					},
				},
				fields: "userEnteredFormat(backgroundColor,textFormat)",
			},
		},
		{
			updateBorders: {
				range: { sheetId: targetSheetId, startRowIndex: 0, endRowIndex: lastRow + 1, startColumnIndex: 0, endColumnIndex: layout.columnCount },
				top: { style: "SOLID", color: { red: 0.75, green: 0.8, blue: 0.88 } },
				bottom: { style: "SOLID", color: { red: 0.75, green: 0.8, blue: 0.88 } },
				left: { style: "SOLID", color: { red: 0.75, green: 0.8, blue: 0.88 } },
				right: { style: "SOLID", color: { red: 0.75, green: 0.8, blue: 0.88 } },
				innerHorizontal: { style: "SOLID", color: { red: 0.88, green: 0.9, blue: 0.94 } },
				innerVertical: { style: "SOLID", color: { red: 0.88, green: 0.9, blue: 0.94 } },
			},
		},
		{
			updateSheetProperties: {
				properties: { sheetId: targetSheetId, gridProperties: { frozenRowCount: 2 } },
				fields: "gridProperties.frozenRowCount",
			},
		},
	];

	for (const row of layout.sectionRows) {
		requests.push({
			repeatCell: {
				range: { sheetId: targetSheetId, startRowIndex: row + 1, endRowIndex: row + 2, startColumnIndex: 0, endColumnIndex: layout.columnCount },
				cell: {
					userEnteredFormat: {
						backgroundColor: { red: 0.12, green: 0.38, blue: 0.62 },
						textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontFamily: "Arial", fontSize: 11 },
					},
				},
				fields: "userEnteredFormat(backgroundColor,textFormat)",
			},
		});
	}

	for (const row of layout.headerRows) {
		requests.push({
			repeatCell: {
				range: { sheetId: targetSheetId, startRowIndex: row + 1, endRowIndex: row + 2, startColumnIndex: 0, endColumnIndex: layout.columnCount },
				cell: {
					userEnteredFormat: {
						backgroundColor: { red: 0.82, green: 0.89, blue: 0.96 },
						textFormat: { bold: true, fontFamily: "Arial", fontSize: 10 },
					},
				},
				fields: "userEnteredFormat(backgroundColor,textFormat)",
			},
		});
	}

	for (let column = 0; column < layout.columnCount; column += 1) {
		requests.push({
			updateDimensionProperties: {
				range: { sheetId: targetSheetId, dimension: "COLUMNS", startIndex: column, endIndex: column + 1 },
				properties: { pixelSize: column === 0 ? 220 : column === 1 ? 180 : column === 3 ? 240 : 130 },
				fields: "pixelSize",
			},
		});
	}

	await sheets.spreadsheets.batchUpdate({
		spreadsheetId: id,
		requestBody: { requests },
	});

	return {
		spreadsheetId: id,
		sheetTitle: targetSheetTitle,
		sheetId: targetSheetId,
		spreadsheetUrl: spreadsheetUrl(id, targetSheetId),
		rows: rows.length + 1,
	};
}
