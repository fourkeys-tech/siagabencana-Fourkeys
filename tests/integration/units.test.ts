import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { approveAndReserveDistribution, damageStock, disposeStock, receiveDistribution, receiveStock, releaseReservation, shipStock } from "@/lib/inventory";
import { POST as createLogistics } from "@/app/api/logistics/route";
import { PUT as updateLogistics } from "@/app/api/logistics/[id]/route";
import { POST as recordMovement } from "@/app/api/logistics/[id]/movements/route";
import { POST as createDistributionRequest } from "@/app/api/distribution/route";
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

/** Barang kemasan yang isinya belum diverifikasi: dicatat per kemasan (identitas, faktor 1). */
async function createPackagedItem(campId: string, data: Partial<{ itemName: string; quantity: number; unit: string }> = {}) {
	const quantity = data.quantity ?? 0;
	const unit = data.unit ?? "dus";
	return prisma.logisticsItem.create({
		data: {
			campId,
			itemName: data.itemName ?? "Mi Instan",
			unit,
			baseUnit: unit,
			unitDimension: "COUNT",
			conversionFactor: 1,
			conversionStatus: "NEEDS_REVIEW",
			quantity,
			quantityBase: quantity,
			status: quantity > 0 ? "SUFFICIENT" : "CRITICAL",
		},
	});
}

const VERIFY_DUS_24 = { unit: "dus", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 24 };

describeDb("unit & konversi", () => {
	let adminId: string;
	let campId: string;
	let destinationId: string;

	beforeEach(async () => {
		await resetDatabase();
		const admin = await createUser({ role: "SUPER_ADMIN" });
		adminId = admin.id;
		currentUser.value = admin;
		campId = (await createCamp({ name: "Asal" })).id;
		destinationId = (await createCamp({ name: "Tujuan" })).id;
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	describe("barang kemasan belum diverifikasi (NEEDS_REVIEW)", () => {
		it("RECEIPT, DAMAGE, dan batas minimum berjalan dalam unit kemasan sendiri", async () => {
			const stock = await createPackagedItem(campId);

			const receipt = await read(await recordMovement(json("POST", { action: "RECEIPT", quantity: 5, reason: "Donasi" }), params(stock.id)));
			expect(receipt.status).toBe(200);
			const damage = await read(await recordMovement(json("POST", { action: "DAMAGE", quantity: 1, reason: "Sobek" }), params(stock.id)));
			expect(damage.status).toBe(200);

			const minimum = await read(await updateLogistics(json("PUT", { minimumQuantity: 2 }), params(stock.id)));
			expect(minimum.status).toBe(200);

			expect(await item(stock.id)).toMatchObject({ quantity: 4, quantityBase: 4, damagedQuantity: 1, damagedQuantityBase: 1, minimumQuantity: 2, minimumQuantityBase: 2, baseUnit: "dus" });
			const movements = await prisma.inventoryMovement.findMany({ where: { logisticsItemId: stock.id }, orderBy: { createdAt: "asc" } });
			expect(movements.map((m) => [m.type, m.quantity, m.unit, m.baseQuantity, m.baseUnit])).toEqual([
				["RECEIPT", 5, "dus", 5, "dus"],
				["DAMAGE", 1, "dus", 1, "dus"],
			]);
		});

		it("verifikasi isi kemasan menghitung ulang semua kolom dasar dan mencatat audit UNIT_VERIFY", async () => {
			const stock = await createPackagedItem(campId);
			await receiveStock({ logisticsItemId: stock.id, quantity: 5, createdById: adminId });
			await damageStock({ logisticsItemId: stock.id, quantity: 1, createdById: adminId, reason: "Sobek" });
			expect((await read(await updateLogistics(json("PUT", { minimumQuantity: 2 }), params(stock.id)))).status).toBe(200);

			const response = await read(await updateLogistics(json("PUT", VERIFY_DUS_24), params(stock.id)));
			expect(response.status).toBe(200);
			expect(response.message).toMatch(/terverifikasi/);
			expect(await item(stock.id)).toMatchObject({
				unit: "dus",
				baseUnit: "pcs",
				unitDimension: "COUNT",
				conversionFactor: 24,
				conversionStatus: "CONFIGURED",
				quantity: 4,
				quantityBase: 96,
				damagedQuantity: 1,
				damagedQuantityBase: 24,
				reservedQuantityBase: 0,
				minimumQuantity: 2,
				minimumQuantityBase: 48,
			});

			const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "UNIT_VERIFY", entityId: stock.id } });
			expect(JSON.parse(audit.details ?? "{}")).toMatchObject({ unit: "dus", oldBaseUnit: "dus", oldFactor: 1, newBaseUnit: "pcs", newFactor: 24, quantityBase: 96 });

			// Saldo rusak memakai faktor baru saat dikeluarkan.
			await disposeStock({ logisticsItemId: stock.id, quantity: 1, createdById: adminId, reason: "Dimusnahkan" });
			expect(await item(stock.id)).toMatchObject({ damagedQuantity: 0, damagedQuantityBase: 0, status: "SUFFICIENT" });

			// Setelah terverifikasi, permintaan dalam pcs bisa dikonversi ke dus.
			const request = await read(await createDistributionRequest(json("POST", { sourceCampId: campId, destinationCampId: destinationId, sourceItemId: stock.id, requestedQuantity: 48, requestedUnit: "pcs" })));
			expect(request.status).toBe(201);
			expect(request.data).toMatchObject({ quantity: 2, unit: "dus", baseQuantity: 48, baseUnit: "pcs" });
		});

		it("verifikasi diblokir saat ada permintaan PENDING atau reservasi; boleh setelah dibatalkan", async () => {
			const stock = await createPackagedItem(campId, { quantity: 10 });
			const request = await createRequest({ sourceCampId: campId, destinationCampId: destinationId, createdById: adminId, itemName: "mi instan", quantity: 3, unit: "dus" });

			const pending = await read(await updateLogistics(json("PUT", VERIFY_DUS_24), params(stock.id)));
			expect(pending.status).toBe(409);
			expect(pending.message).toMatch(/tidak dapat diverifikasi/);

			const approved = await approveAndReserveDistribution({ requestId: request.id, sourceItemId: stock.id, quantity: 3, createdById: adminId });
			expect(await item(stock.id)).toMatchObject({ reservedQuantity: 3, reservedQuantityBase: 3 });
			expect((await read(await updateLogistics(json("PUT", VERIFY_DUS_24), params(stock.id)))).status).toBe(409);
			expect(await item(stock.id)).toMatchObject({ conversionStatus: "NEEDS_REVIEW", quantityBase: 10 });

			await releaseReservation({ distributionId: approved.id, createdById: adminId });
			expect((await read(await updateLogistics(json("PUT", VERIFY_DUS_24), params(stock.id)))).status).toBe(200);
			expect(await item(stock.id)).toMatchObject({ conversionStatus: "CONFIGURED", quantity: 10, quantityBase: 240 });
		});

		it("mengganti unit atau faktor terverifikasi saat ada stok tetap terkunci", async () => {
			const packaged = await createPackagedItem(campId, { quantity: 4 });
			const otherUnit = await read(await updateLogistics(json("PUT", { unit: "box", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 10 }), params(packaged.id)));
			expect(otherUnit.status).toBe(409);
			expect(otherUnit.message).toMatch(/Verifikasi isi kemasan/);

			expect((await read(await updateLogistics(json("PUT", VERIFY_DUS_24), params(packaged.id)))).status).toBe(200);
			const refactor = await read(await updateLogistics(json("PUT", { conversionFactor: 12 }), params(packaged.id)));
			expect(refactor.status).toBe(409);
			expect(await item(packaged.id)).toMatchObject({ conversionFactor: 24, quantityBase: 96 });

			const standard = await createItem(campId, { quantity: 5 });
			expect((await read(await updateLogistics(json("PUT", { unit: "dus" }), params(standard.id)))).status).toBe(409);
		});

		it("barang lama dengan unit alias (kardus) tetap bisa diverifikasi saat ada saldo", async () => {
			const stock = await createPackagedItem(campId, { unit: "kardus", quantity: 3 });
			// Form verifikasi mengirim unit item apa adanya.
			const response = await read(await updateLogistics(json("PUT", { ...VERIFY_DUS_24, unit: "kardus" }), params(stock.id)));
			expect(response.status).toBe(200);
			expect(await item(stock.id)).toMatchObject({ unit: "dus", baseUnit: "pcs", conversionFactor: 24, conversionStatus: "CONFIGURED", quantity: 3, quantityBase: 72 });
			const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "UNIT_VERIFY", entityId: stock.id } });
			expect(JSON.parse(audit.details ?? "{}")).toMatchObject({ oldUnit: "kardus", oldBaseUnit: "kardus", oldFactor: 1 });

			// Tanpa perubahan definisi, alias tidak dianggap penggantian unit (tidak terkunci).
			const legacy = await createPackagedItem(campId, { itemName: "Selimut", unit: "kardus", quantity: 2 });
			expect((await read(await updateLogistics(json("PUT", { unit: "kardus", notes: "cek" }), params(legacy.id)))).status).toBe(200);
		});

		it("conversionStatus dari client diabaikan", async () => {
			const stock = await createPackagedItem(campId);
			const response = await read(await updateLogistics(json("PUT", { conversionStatus: "CONFIGURED", notes: "x" }), params(stock.id)));
			expect(response.status).toBe(200);
			expect((await item(stock.id)).conversionStatus).toBe("NEEDS_REVIEW");
		});
	});

	describe("POST /api/logistics definisi unit", () => {
		const create = async (body: Record<string, unknown>) => read(await createLogistics(json("POST", { campId, itemName: "Barang", quantity: 0, ...body })));

		it("unit standar wajib memakai definisi resmi", async () => {
			const wrongFactor = await create({ unit: "kg", baseUnit: "g", unitDimension: "MASS", conversionFactor: 500 });
			expect(wrongFactor.status).toBe(400);
			expect(wrongFactor.message).toMatch(/Unit standar/);
			expect((await create({ unit: "kg", baseUnit: "pcs" })).status).toBe(400);
			expect(await prisma.logisticsItem.count()).toBe(0);

			const alias = await create({ unit: "Kilogram", quantity: 2 });
			expect(alias.status).toBe(201);
			expect(alias.data).toMatchObject({ unit: "kg", baseUnit: "g", conversionFactor: 1000, quantity: 2, quantityBase: 2000 });
		});

		it("kemasan dengan isi → CONFIGURED; stok awal tercatat dalam unit kemasan", async () => {
			const created = await create({ itemName: "Air Mineral", unit: "dus", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 24, quantity: 2 });
			expect(created.status).toBe(201);
			expect(created.data).toMatchObject({ unit: "dus", baseUnit: "pcs", conversionFactor: 24, conversionStatus: "CONFIGURED", quantity: 2, quantityBase: 48 });

			const [movement] = await prisma.inventoryMovement.findMany({ where: { logisticsItemId: String(created.data?.id) } });
			expect(movement).toMatchObject({ type: "RECEIPT", quantity: 2, unit: "dus", baseQuantity: 48, baseUnit: "pcs" });
		});

		it("kemasan tanpa isi → NEEDS_REVIEW identitas meski client mengirim CONFIGURED", async () => {
			const created = await create({ itemName: "Beras", unit: "karung", quantity: 4, conversionStatus: "CONFIGURED" });
			expect(created.status).toBe(201);
			expect(created.data).toMatchObject({ unit: "karung", baseUnit: "karung", conversionFactor: 1, conversionStatus: "NEEDS_REVIEW", quantity: 4, quantityBase: 4 });
		});

		it("unit di luar katalog atau unit dasar salah dimensi → 400", async () => {
			expect((await create({ unit: "ember" })).status).toBe(400);
			expect((await create({ unit: "galon", baseUnit: "g", unitDimension: "VOLUME", conversionFactor: 19000 })).status).toBe(400);
			expect(await prisma.logisticsItem.count()).toBe(0);
		});
	});

	describe("backfill migration InventoryMovement.unit", () => {
		// Menjalankan ulang UPDATE dari migration terhadap baris lama (unit NULL).
		async function runBackfill() {
			const sql = readFileSync(join(process.cwd(), "prisma/migrations/20261104000000_add_inventory_movement_unit/migration.sql"), "utf8");
			const statements = sql
				.split("\n")
				.filter((line) => !line.trim().startsWith("--"))
				.join("\n")
				.split(";")
				.map((statement) => statement.trim())
				.filter((statement) => statement.startsWith("UPDATE"));
			expect(statements).toHaveLength(2);
			for (const statement of statements) await prisma.$executeRawUnsafe(statement);
		}

		async function legacyMovement(logisticsItemId: string, definition: { baseUnit: string; unitDimension: "COUNT" | "MASS" | "VOLUME"; conversionFactor: number }, quantity = 1) {
			return prisma.inventoryMovement.create({
				data: { logisticsItemId, campId, type: "RECEIPT", quantity, unit: null, baseQuantity: quantity * definition.conversionFactor, ...definition },
			});
		}

		it("memakai unit item hanya bila definisinya sama; selain itu diturunkan atau dibiarkan kosong", async () => {
			// Item sekarang kg, dulu pernah pcs lalu box (unit diganti saat saldo kosong).
			const rice = await prisma.logisticsItem.create({
				data: { campId, itemName: "Beras", unit: "kg", baseUnit: "g", unitDimension: "MASS", conversionFactor: 1000, conversionStatus: "CONFIGURED", quantity: 0, quantityBase: 0 },
			});
			const asKg = await legacyMovement(rice.id, { baseUnit: "g", unitDimension: "MASS", conversionFactor: 1000 });
			const asPcs = await legacyMovement(rice.id, { baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 1 }, 10);
			const asBox = await legacyMovement(rice.id, { baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 10 });
			const asLiter = await legacyMovement(rice.id, { baseUnit: "ml", unitDimension: "VOLUME", conversionFactor: 1000 });

			// Item sekarang dus terverifikasi, dulu dicatat per dus (identitas).
			const noodles = await prisma.logisticsItem.create({
				data: { campId, itemName: "Mi", unit: "dus", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 24, conversionStatus: "CONFIGURED", quantity: 0, quantityBase: 0 },
			});
			const asVerifiedDus = await legacyMovement(noodles.id, { baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 24 });
			const asIdentityDus = await legacyMovement(noodles.id, { baseUnit: "dus", unitDimension: "COUNT", conversionFactor: 1 });
			const alreadySet = await prisma.inventoryMovement.create({
				data: { logisticsItemId: noodles.id, campId, type: "RECEIPT", quantity: 1, unit: "box", baseQuantity: 24, baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 24 },
			});

			await runBackfill();

			const units = Object.fromEntries((await prisma.inventoryMovement.findMany()).map((m) => [m.id, m.unit]));
			expect(units).toEqual({
				[asKg.id]: "kg",
				[asPcs.id]: "pcs",
				[asBox.id]: null,
				[asLiter.id]: "l",
				[asVerifiedDus.id]: "dus",
				[asIdentityDus.id]: "dus",
				[alreadySet.id]: "box",
			});
		});
	});

	describe("distribusi barang kemasan", () => {
		it("NEEDS_REVIEW: permintaan dalam unit lain ditolak; unit yang sama mengalir sampai diterima", async () => {
			const stock = await createPackagedItem(campId, { quantity: 10 });
			const body = { sourceCampId: campId, destinationCampId: destinationId, sourceItemId: stock.id, requestedQuantity: 3 };

			const crossUnit = await read(await createDistributionRequest(json("POST", { ...body, requestedUnit: "pcs" })));
			expect(crossUnit.status).toBe(400);
			expect(crossUnit.message).toMatch(/Isi kemasan belum didefinisikan/);

			const created = await read(await createDistributionRequest(json("POST", { ...body, requestedUnit: "dus" })));
			expect(created.status).toBe(201);
			expect(created.data).toMatchObject({ quantity: 3, unit: "dus", baseQuantity: 3, baseUnit: "dus", conversionStatus: "NEEDS_REVIEW" });

			const approved = await approveAndReserveDistribution({ requestId: String(created.data?.id), sourceItemId: stock.id, quantity: 3, createdById: adminId });
			await shipStock({ distributionId: approved.id, createdById: adminId });
			await receiveDistribution({ distributionId: approved.id, createdById: adminId });

			expect(await item(stock.id)).toMatchObject({ quantity: 7, quantityBase: 7, reservedQuantity: 0 });
			const target = await prisma.logisticsItem.findFirstOrThrow({ where: { campId: destinationId } });
			expect(target).toMatchObject({ itemName: "Mi Instan", unit: "dus", baseUnit: "dus", conversionStatus: "NEEDS_REVIEW", quantity: 3, quantityBase: 3 });

			const inbound = await prisma.inventoryMovement.findFirstOrThrow({ where: { distributionId: approved.id, type: "DISTRIBUTION_IN" } });
			expect(inbound).toMatchObject({ quantity: 3, unit: "dus", baseQuantity: 3, baseUnit: "dus" });
		});

		it("penerimaan mencocokkan nama barang tanpa membedakan huruf besar/kecil", async () => {
			const stock = await createItem(campId, { itemName: "Beras", quantity: 10 });
			const existing = await createItem(destinationId, { itemName: "beras", quantity: 2 });
			const request = await createRequest({ sourceCampId: campId, destinationCampId: destinationId, createdById: adminId, itemName: "Beras", quantity: 5 });

			const approved = await approveAndReserveDistribution({ requestId: request.id, sourceItemId: stock.id, quantity: 5, createdById: adminId });
			await shipStock({ distributionId: approved.id, createdById: adminId });
			await receiveDistribution({ distributionId: approved.id, createdById: adminId });

			expect(await item(existing.id)).toMatchObject({ quantity: 7, quantityBase: 7 });
			expect(await prisma.logisticsItem.count({ where: { campId: destinationId } })).toBe(1);
		});
	});
});
