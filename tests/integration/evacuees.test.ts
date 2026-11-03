import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as registerEvacuee } from "@/app/api/evacuees/route";
import { POST as checkoutEvacuee } from "@/app/api/evacuees/[id]/checkout/route";
import { createCamp, createUser, describeDb, resetDatabase } from "./helpers";

// Route handler dipanggil langsung; sesi diganti user test agar tidak butuh cookie Next.js.
const currentUser = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => currentUser.value }));

function jsonRequest(body: unknown) {
	return new Request("http://localhost/api/evacuees", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describeDb("evacuee registration & checkout", () => {
	let campId: string;

	beforeEach(async () => {
		await resetDatabase();
		campId = (await createCamp({ maxCapacity: 10 })).id;
		currentUser.value = await createUser({ role: "SUPER_ADMIN" });
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("registrasi menambah okupansi, checkout menguranginya, checkout ganda ditolak", async () => {
		const created = await registerEvacuee(jsonRequest({ campId, name: "Budi", totalFamily: 4 }));
		expect(created.status).toBe(201);
		const { data } = await created.json();
		expect((await prisma.camp.findUniqueOrThrow({ where: { id: campId } })).currentOccupants).toBe(4);

		const params = { params: Promise.resolve({ id: data.id }) };
		const first = await checkoutEvacuee(new Request("http://localhost"), params);
		expect(first.status).toBe(200);
		expect((await prisma.camp.findUniqueOrThrow({ where: { id: campId } })).currentOccupants).toBe(0);

		const second = await checkoutEvacuee(new Request("http://localhost"), { params: Promise.resolve({ id: data.id }) });
		expect(second.status).toBe(409);
		expect((await prisma.camp.findUniqueOrThrow({ where: { id: campId } })).currentOccupants).toBe(0);
	});

	it("registrasi melebihi kapasitas ditolak", async () => {
		const response = await registerEvacuee(jsonRequest({ campId, name: "Rombongan", totalFamily: 11 }));
		expect(response.status).toBe(409);
		expect((await prisma.camp.findUniqueOrThrow({ where: { id: campId } })).currentOccupants).toBe(0);
	});

	it("registrasi ke posko CLOSED ditolak", async () => {
		const closed = await createCamp({ status: "CLOSED" });
		const response = await registerEvacuee(jsonRequest({ campId: closed.id, name: "Ani", totalFamily: 1 }));
		expect(response.status).toBe(409);
	});
});
