import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { approveAndReserveDistribution } from "@/lib/inventory";
import { PUT as updateCamp } from "@/app/api/camps/[id]/route";
import { PUT as assignManager } from "@/app/api/camps/[id]/manager/route";
import { PUT as updateLogistics } from "@/app/api/logistics/[id]/route";
import { POST as registerEvacuee } from "@/app/api/evacuees/route";
import { GET as listDistribution } from "@/app/api/distribution/route";
import { GET as cronCleanup } from "@/app/api/cron/cleanup/route";
import { GET as getReports } from "@/app/api/reports/route";
import { createCamp, createItem, createRequest, createUser, describeDb, item, resetDatabase } from "./helpers";

// Route handler dipanggil langsung; sesi diganti user test agar tidak butuh cookie Next.js.
const currentUser = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => currentUser.value }));

function json(method: string, body: unknown) {
	return new Request("http://localhost/api/test", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function read(response: Response) {
	return { status: response.status, ...(await response.json()) as { success: boolean; message?: string; data?: Record<string, unknown> } };
}

describeDb("route Fase B", () => {
	let adminId: string;

	beforeEach(async () => {
		await resetDatabase();
		const admin = await createUser({ role: "SUPER_ADMIN" });
		adminId = admin.id;
		currentUser.value = admin;
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	describe("PUT /api/camps/[id] tutup posko", () => {
		it("ditolak bila masih ada pengungsi", async () => {
			const camp = await createCamp({ currentOccupants: 3 });
			const response = await read(await updateCamp(json("PUT", { status: "CLOSED" }), params(camp.id)));
			expect(response).toMatchObject({ status: 409, success: false });
			expect(response.message).toMatch(/pengungsi aktif/);
			expect((await prisma.camp.findUniqueOrThrow({ where: { id: camp.id } })).status).toBe("ACTIVE");
		});

		it("ditolak bila ada distribusi berjalan", async () => {
			const source = await createCamp();
			const destination = await createCamp();
			const stock = await createItem(source.id, { quantity: 5 });
			const request = await createRequest({ sourceCampId: source.id, destinationCampId: destination.id, createdById: adminId, quantity: 2 });
			await approveAndReserveDistribution({ requestId: request.id, sourceItemId: stock.id, quantity: 2, createdById: adminId });

			const response = await read(await updateCamp(json("PUT", { status: "CLOSED" }), params(destination.id)));
			expect(response.status).toBe(409);
			expect(response.message).toMatch(/distribusi/);
		});

		it("posko kosong berhasil ditutup; kapasitas di bawah okupan → 400", async () => {
			const empty = await createCamp();
			expect((await read(await updateCamp(json("PUT", { status: "CLOSED" }), params(empty.id)))).status).toBe(200);
			expect((await prisma.camp.findUniqueOrThrow({ where: { id: empty.id } })).status).toBe("CLOSED");

			const occupied = await createCamp({ maxCapacity: 10, currentOccupants: 6 });
			expect((await read(await updateCamp(json("PUT", { maxCapacity: 5 }), params(occupied.id)))).status).toBe(400);
		});

		it("posko tidak ada → 404", async () => {
			expect((await read(await updateCamp(json("PUT", { name: "X" }), params("tidak-ada")))).status).toBe(404);
		});
	});

	describe("PUT /api/camps/[id]/manager", () => {
		it("manager yang sudah memimpin posko lain → 409 (P2002 asli dari adapter-pg)", async () => {
			const campA = await createCamp();
			const campB = await createCamp();
			const manager = await createUser({ role: "MANAGER", campId: campB.id });
			await prisma.camp.update({ where: { id: campA.id }, data: { managerId: manager.id } });

			const response = await read(await assignManager(json("PUT", { userId: manager.id }), params(campB.id)));
			expect(response).toMatchObject({ status: 409, message: "Manager tersebut sudah memimpin posko lain." });
		});

		it("user bukan manager posko itu → 400; posko CLOSED → 409", async () => {
			const camp = await createCamp();
			const officer = await createUser({ role: "FIELD_OFFICER", division: "LOGISTICS", campId: camp.id });
			expect((await read(await assignManager(json("PUT", { userId: officer.id }), params(camp.id)))).status).toBe(400);

			const closed = await createCamp({ status: "CLOSED" });
			expect((await read(await assignManager(json("PUT", { userId: null }), params(closed.id)))).status).toBe(409);
		});
	});

	describe("PUT /api/logistics/[id]", () => {
		it("unit terkunci saat ada stok → 409, stok tidak berubah", async () => {
			const camp = await createCamp();
			const stock = await createItem(camp.id, { quantity: 10 });
			const response = await read(await updateLogistics(json("PUT", { unit: "kg" }), params(stock.id)));
			expect(response.status).toBe(409);
			expect(await item(stock.id)).toMatchObject({ unit: "pcs", quantity: 10, quantityBase: 10 });
		});

		it("unit boleh diganti saat stok kosong", async () => {
			const camp = await createCamp();
			const empty = await createItem(camp.id, { quantity: 0 });
			const response = await read(await updateLogistics(json("PUT", { unit: "kg" }), params(empty.id)));
			expect(response.status).toBe(200);
			expect((await item(empty.id)).unit).toBe("kg");
		});

		it("minimumQuantity baru langsung me-refresh status", async () => {
			const camp = await createCamp();
			const stock = await createItem(camp.id, { quantity: 10 });
			expect((await read(await updateLogistics(json("PUT", { minimumQuantity: 10 }), params(stock.id)))).status).toBe(200);
			expect(await item(stock.id)).toMatchObject({ minimumQuantity: 10, minimumQuantityBase: 10, status: "LOW" });
		});

		it("field stok dan minimum pecahan → 400; posko CLOSED → 409", async () => {
			const camp = await createCamp();
			const stock = await createItem(camp.id);
			expect((await read(await updateLogistics(json("PUT", { quantity: 99 }), params(stock.id)))).status).toBe(400);
			expect((await read(await updateLogistics(json("PUT", { minimumQuantity: 1.5 }), params(stock.id)))).status).toBe(400);

			await prisma.camp.update({ where: { id: camp.id }, data: { status: "CLOSED" } });
			expect((await read(await updateLogistics(json("PUT", { notes: "x" }), params(stock.id)))).status).toBe(409);
		});
	});

	describe("POST /api/evacuees hasSpecialNeeds", () => {
		it("\"false\" disimpan sebagai false; nilai lain → 400", async () => {
			const camp = await createCamp();
			const created = await read(await registerEvacuee(json("POST", { campId: camp.id, name: "Sari", totalFamily: 2, hasSpecialNeeds: "false" })));
			expect(created.status).toBe(201);
			const record = await prisma.evacueeRecord.findUniqueOrThrow({ where: { id: String(created.data?.id) } });
			expect(record.hasSpecialNeeds).toBe(false);

			const invalid = await read(await registerEvacuee(json("POST", { campId: camp.id, name: "Tono", totalFamily: 1, hasSpecialNeeds: "maybe" })));
			expect(invalid.status).toBe(400);
			expect((await prisma.camp.findUniqueOrThrow({ where: { id: camp.id } })).currentOccupants).toBe(2);
		});
	});

	describe("GET /api/distribution?status", () => {
		it("status tidak dikenal → 400; status valid (case-insensitive) memfilter", async () => {
			expect((await read(await listDistribution(new Request("http://localhost/api/distribution?status=BOGUS")))).status).toBe(400);

			const source = await createCamp();
			const destination = await createCamp();
			await createRequest({ sourceCampId: source.id, destinationCampId: destination.id, createdById: adminId, quantity: 1 });

			const pending = await read(await listDistribution(new Request("http://localhost/api/distribution?status=pending")));
			expect(pending.status).toBe(200);
			expect((pending.data?.requests as unknown[]).length).toBe(1);

			const shipped = await read(await listDistribution(new Request("http://localhost/api/distribution?status=SHIPPED")));
			expect((shipped.data?.requests as unknown[]).length).toBe(0);
		});
	});

	describe("GET /api/cron/cleanup", () => {
		afterEach(() => vi.unstubAllEnvs());

		it("butuh Bearer CRON_SECRET yang tepat", async () => {
			vi.stubEnv("CRON_SECRET", "rahasia-test");
			const cron = (authorization?: string) => cronCleanup(new Request("http://localhost/api/cron/cleanup", { headers: authorization ? { authorization } : {} }));

			expect((await cron()).status).toBe(401);
			expect((await cron("Bearer salah")).status).toBe(401);
			expect((await cron("Bearer rahasia-test")).status).toBe(200);
		});

		it("tanpa secret: ditolak di production (fail-closed)", async () => {
			vi.stubEnv("CRON_SECRET", "");
			vi.stubEnv("VERCEL_ENV", "production");
			vi.spyOn(console, "error").mockImplementation(() => {});
			expect((await cronCleanup(new Request("http://localhost/api/cron/cleanup"))).status).toBe(401);
		});
	});

	describe("GET /api/reports", () => {
		it("mengembalikan data laporan snapshot & periode secara terkonsolidasi", async () => {
			const camp = await createCamp({ maxCapacity: 200, currentOccupants: 15 });
			const itemStock = await createItem(camp.id, { itemName: "Beras Pandan", quantity: 50 });

			// Buat transaksi mutasi stok
			await prisma.inventoryMovement.create({
				data: {
					logisticsItemId: itemStock.id,
					campId: camp.id,
					type: "RECEIPT",
					quantity: 20,
					unit: "pcs",
					baseQuantity: 20,
					baseUnit: "pcs",
					reason: "Bantuan masuk",
				},
			});

			// Buat pengungsi
			await prisma.evacueeRecord.create({
				data: {
					campId: camp.id,
					name: "Siti Rahma",
					totalFamily: 4,
					arrivedAt: new Date(),
				},
			});

			const res = await getReports(new Request("http://localhost/api/reports?from=2026-11-01&to=2026-11-04"));
			expect(res.status).toBe(200);
			const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
			expect(body.success).toBe(true);

			const summary = body.data.summary as Record<string, number>;
			expect(summary.totalCamps).toBe(1);
			expect(summary.totalCapacity).toBe(200);
			expect(summary.totalOccupants).toBe(15);
			expect(summary.arrivedEvacueeFamilies).toBe(4);
			expect(summary.totalMovementsCount).toBe(1);

			const movements = body.data.stockMovements as Array<Record<string, unknown>>;
			expect(movements).toHaveLength(1);
			expect(movements[0]?.itemName).toBe("Beras Pandan");
			expect(movements[0]?.receiptQty).toBe(20);
		});

		it("format=csv mengembalikan stream CSV lengkap dengan UTF-8 BOM", async () => {
			const camp = await createCamp({ maxCapacity: 100, currentOccupants: 5 });
			await createItem(camp.id, { itemName: "Minyak Goreng", quantity: 10 });

			const res = await getReports(new Request("http://localhost/api/reports?from=2026-11-01&to=2026-11-04&format=csv"));
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("text/csv");
			expect(res.headers.get("content-disposition")).toContain("attachment; filename=");

			const buffer = await res.arrayBuffer();
			const bytes = new Uint8Array(buffer);
			expect(bytes[0]).toBe(0xef);
			expect(bytes[1]).toBe(0xbb);
			expect(bytes[2]).toBe(0xbf);
			const text = new TextDecoder().decode(buffer);
			expect(text).toContain("LAPORAN OPERASIONAL SIAGA BENCANA");
			expect(text).toContain("Minyak Goreng");
		});

		it("menolak parameter tanggal yang tidak valid dengan 400", async () => {
			const invalidDate = await getReports(new Request("http://localhost/api/reports?from=2026-02-31&to=2026-11-04"));
			expect(invalidDate.status).toBe(400);

			const invertedRange = await getReports(new Request("http://localhost/api/reports?from=2026-11-10&to=2026-11-01"));
			expect(invertedRange.status).toBe(400);
		});
	});
});
