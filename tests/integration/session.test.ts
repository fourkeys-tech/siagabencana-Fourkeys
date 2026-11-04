import crypto from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteSession } from "@/lib/auth/session";
import { createUser, describeDb, resetDatabase } from "./helpers";

// Cookie store Next.js diganti stub agar deleteSession bisa dipanggil di luar request.
const cookie = vi.hoisted(() => ({ token: undefined as string | undefined, deleted: false }));
vi.mock("next/headers", () => ({
	cookies: async () => ({
		get: () => (cookie.token ? { value: cookie.token } : undefined),
		delete: () => { cookie.deleted = true; },
	}),
}));

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

async function createSession(userId: string, expiresInMs: number) {
	const token = crypto.randomBytes(16).toString("hex");
	await prisma.session.create({ data: { userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + expiresInMs) } });
	return token;
}

describeDb("deleteSession (logout)", () => {
	beforeEach(async () => {
		await resetDatabase();
		cookie.token = undefined;
		cookie.deleted = false;
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	describe("sesi berlaku", () => {
		it("dihapus dalam satu query dan mengembalikan userId; sesi lain user tetap ada", async () => {
			const user = await createUser();
			cookie.token = await createSession(user.id, 60_000);
			const otherDevice = await createSession(user.id, 60_000);

			expect(await deleteSession()).toBe(user.id);
			expect(cookie.deleted).toBe(true);
			expect(await prisma.session.count({ where: { tokenHash: hash(cookie.token) } })).toBe(0);
			expect(await prisma.session.count({ where: { tokenHash: hash(otherDevice) } })).toBe(1);
		});
	});

	describe("sesi tidak berlaku", () => {
		it("kedaluwarsa: tetap dihapus, tidak mengembalikan userId (tidak diaudit)", async () => {
			const user = await createUser();
			cookie.token = await createSession(user.id, -60_000);

			expect(await deleteSession()).toBeNull();
			expect(await prisma.session.count()).toBe(0);
		});

		it("tanpa cookie atau token tak dikenal → null, cookie tetap dihapus", async () => {
			expect(await deleteSession()).toBeNull();
			expect(cookie.deleted).toBe(true);

			cookie.token = "tidak-dikenal";
			expect(await deleteSession()).toBeNull();
		});
	});
});
