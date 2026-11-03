import { NextResponse } from "next/server";

export type PaginationParams = {
	page?: number;
	limit?: number;
};

export type PaginatedResponse<T> = {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
};

// Bilangan bulat positif dari query; pecahan dibulatkan ke bawah (Prisma menolak skip/take pecahan → 500),
// NaN/Infinity/≤0 memakai fallback.
function positiveInt(raw: string | null, fallback: number) {
	const value = Math.floor(Number(raw));
	return Number.isSafeInteger(value) && value >= 1 ? value : fallback;
}

export function parsePagination(url: URL, defaultLimit = 50, maxLimit = 100): PaginationParams {
	const page = positiveInt(url.searchParams.get("page"), 1);
	const limit = Math.min(positiveInt(url.searchParams.get("limit"), defaultLimit), maxLimit);
	return { page, limit };
}

export function paginated<T>(data: T[], total: number, params: PaginationParams): PaginatedResponse<T> {
	const page = params.page ?? 1;
	const limit = params.limit ?? 50;
	return {
		data,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.max(Math.ceil(total / limit), 1),
		},
	};
}

export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams) {
	return NextResponse.json({ success: true, ...paginated(data, total, params) });
}