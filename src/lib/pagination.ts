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

export function parsePagination(url: URL, defaultLimit = 50, maxLimit = 100): PaginationParams {
	const page = Math.max(Number(url.searchParams.get("page") ?? 1) || 1, 1);
	const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? defaultLimit) || defaultLimit, 1), maxLimit);
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