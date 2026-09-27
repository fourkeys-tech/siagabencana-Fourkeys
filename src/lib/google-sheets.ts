import "server-only";
import { google, sheets_v4 } from "googleapis";

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const encodedCredentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;

function getCredentials() {
	if (!encodedCredentials) {
		throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not configured");
	}

	try {
		return JSON.parse(Buffer.from(encodedCredentials, "base64").toString("utf8")) as {
			client_email: string;
			private_key: string;
		};
	} catch {
		throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is invalid");
	}
}

function getSheetsClient() {
	if (!spreadsheetId) {
		throw new Error("GOOGLE_SPREADSHEET_ID is not configured");
	}

	const auth = new google.auth.GoogleAuth({
		credentials: getCredentials(),
		scopes: ["https://www.googleapis.com/auth/spreadsheets"],
	});

	return {
		spreadsheetId,
		sheets: google.sheets({ version: "v4", auth }),
	};
}

export type ReportSheetRow = Array<string | number>;

export type ReportSheetLayout = {
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

export async function writeReportToGoogleSheet(
	rows: ReportSheetRow[],
	title: string,
	layout: ReportSheetLayout,
) {
	const { sheets, spreadsheetId: id } = getSheetsClient();
	const metadata = await sheets.spreadsheets.get({
		spreadsheetId: id,
		fields: "sheets.properties",
	});
	const sheet = metadata.data.sheets?.[0]?.properties;

	if (sheet?.sheetId === undefined || !sheet.title) {
		throw new Error("Google spreadsheet does not contain a writable sheet");
	}

	const lastColumn = columnLetter(Math.max(layout.columnCount - 1, 0));
	const lastRow = Math.max(rows.length + 1, 1);
	const range = `${sheet.title}!A1:${lastColumn}${lastRow}`;
	const fullColumnRange = `${sheet.title}!A:Z`;

	await sheets.spreadsheets.values.clear({
		spreadsheetId: id,
		range: fullColumnRange,
	});

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
					sheetId: sheet.sheetId,
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
				range: { sheetId: sheet.sheetId, startRowIndex: titleRow, endRowIndex: titleRow + 1, startColumnIndex: 0, endColumnIndex: layout.columnCount },
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
				range: { sheetId: sheet.sheetId, startRowIndex: periodRow, endRowIndex: periodRow + 1, startColumnIndex: 0, endColumnIndex: layout.columnCount },
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
					range: { sheetId: sheet.sheetId, startRowIndex: 0, endRowIndex: lastRow + 1, startColumnIndex: 0, endColumnIndex: layout.columnCount },
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
				properties: { sheetId: sheet.sheetId, gridProperties: { frozenRowCount: 2 } },
				fields: "gridProperties.frozenRowCount",
			},
		},
	];

	for (const row of layout.sectionRows) {
		requests.push({
			repeatCell: {
				range: { sheetId: sheet.sheetId, startRowIndex: row + 1, endRowIndex: row + 2, startColumnIndex: 0, endColumnIndex: layout.columnCount },
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
				range: { sheetId: sheet.sheetId, startRowIndex: row + 1, endRowIndex: row + 2, startColumnIndex: 0, endColumnIndex: layout.columnCount },
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
				range: { sheetId: sheet.sheetId, dimension: "COLUMNS", startIndex: column, endIndex: column + 1 },
				properties: { pixelSize: column === 0 ? 220 : column === 1 ? 180 : column === 3 ? 240 : 130 },
				fields: "pixelSize",
			},
		});
	}

	await sheets.spreadsheets.batchUpdate({
		spreadsheetId: id,
		requestBody: { requests },
	});

	return { spreadsheetId: id, sheetTitle: sheet.title, rows: rows.length + 1 };
}
