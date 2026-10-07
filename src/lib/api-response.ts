import { NextResponse } from "next/server";

export function ok<T>(data: T, message?: string, status = 200) {
	return NextResponse.json({ success: true, ...(message ? { message } : {}), data }, { status });
}

export function fail(message: string, status = 400) {
	return NextResponse.json({ success: false, message }, { status });
}

export function unauthorized() {
	return fail("Unauthorized", 401);
}

export function forbidden(message = "Forbidden") {
	return fail(message, 403);
}

export function notFound(message = "Data tidak ditemukan.") {
	return fail(message, 404);
}

export function conflict(message: string) {
	return fail(message, 409);
}

export function serverError(message = "Terjadi kesalahan pada server.") {
	return fail(message, 500);
}