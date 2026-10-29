import { NextResponse } from "next/server";

export class InvalidJsonError extends Error {
	constructor() {
		super("INVALID_JSON");
	}
}

// Body JSON harus objek; JSON rusak atau tipe lain dilempar sebagai INVALID_JSON (400).
export async function readJson(request: Request): Promise<Record<string, unknown>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw new InvalidJsonError();
	}
	if (!body || typeof body !== "object" || Array.isArray(body)) throw new InvalidJsonError();
	return body as Record<string, unknown>;
}

export function isInvalidJson(error: unknown) {
	return error instanceof InvalidJsonError;
}

export function invalidJsonResponse() {
	return NextResponse.json({ success: false, message: "Format data permintaan tidak valid." }, { status: 400 });
}

export function badRequest(message: string) {
	return NextResponse.json({ success: false, message }, { status: 400 });
}

export function conflict(message: string) {
	return NextResponse.json({ success: false, message }, { status: 409 });
}
