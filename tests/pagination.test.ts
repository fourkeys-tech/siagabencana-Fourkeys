import { describe, expect, it } from "vitest";
import { parsePagination, paginated, paginatedResponse } from "../src/lib/pagination";

describe("pagination helpers", () => {
	it("parses default values when query params absent", () => {
		const url = new URL("https://example.com/api/camps");
		const params = parsePagination(url);
		expect(params.page).toBe(1);
		expect(params.limit).toBe(50);
	});

	it("parses query params with clamping", () => {
		const url = new URL("https://example.com/api/camps?page=3&limit=200");
		const params = parsePagination(url);
		expect(params.page).toBe(3);
		expect(params.limit).toBe(100); // clamped to maxLimit
	});

	it("clamps to minimum page 1", () => {
		const url = new URL("https://example.com/api/camps?page=-5");
		const params = parsePagination(url);
		expect(params.page).toBe(1);
	});

	it("uses custom default limit", () => {
		const url = new URL("https://example.com/api/camps");
		const params = parsePagination(url, 25);
		expect(params.limit).toBe(25);
	});

	it("returns empty paginated structure", () => {
		const result = paginated([], 0, { page: 1, limit: 10 });
		expect(result.data).toEqual([]);
		expect(result.pagination).toEqual({ page: 1, limit: 10, total: 0, totalPages: 1 });
	});

	it("calculates totalPages correctly", () => {
		const result = paginated([1, 2, 3], 25, { page: 1, limit: 10 });
		expect(result.pagination.totalPages).toBe(3);
	});

	it("creates NextResponse from paginatedResponse", async () => {
		const response = paginatedResponse([{ id: "1" }], 1, { page: 1, limit: 10 });
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.data).toEqual([{ id: "1" }]);
		expect(body.pagination).toBeDefined();
	});
});