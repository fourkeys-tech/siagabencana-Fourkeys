type ApiResponse<T> = {
	ok: boolean;
	data: T | null;
	message?: string;
	status: number;
};

async function request<T>(
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
	path: string,
	body?: unknown,
): Promise<ApiResponse<T>> {
	try {
		const response = await fetch(path, {
			method,
			headers: body ? { "Content-Type": "application/json" } : undefined,
			body: body ? JSON.stringify(body) : undefined,
		});
		const json = await response.json().catch(() => ({ success: false, message: "Respons tidak valid." }));
		return {
			ok: response.ok && json.success !== false,
			data: json.data ?? null,
			message: json.message,
			status: response.status,
		};
	} catch (error) {
		return {
			ok: false,
			data: null,
			message: error instanceof Error ? error.message : "Terjadi kesalahan jaringan.",
			status: 0,
		};
	}
}

export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>("POST", path, body);
export const apiPut = <T>(path: string, body?: unknown) => request<T>("PUT", path, body);
export const apiPatch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, body);
export const apiDelete = <T>(path: string) => request<T>("DELETE", path);