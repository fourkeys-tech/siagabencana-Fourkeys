import { afterAll, beforeEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { damageStock, disposeStock, receiveStock, recordLoss, restoreStock } from "@/lib/inventory";
import { createCamp, createItem, createUser, describeDb, item, resetDatabase } from "./helpers";

describeDb("inventory ledger", () => {
	let campId: string;
	let userId: string;

	beforeEach(async () => {
		await resetDatabase();
		campId = (await createCamp()).id;
		userId = (await createUser()).id;
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("RECEIPT menambah stok dan mencatat ledger dengan baseQuantity", async () => {
		const stock = await createItem(campId, { quantity: 10 });
		const updated = await receiveStock({ logisticsItemId: stock.id, quantity: 5, createdById: userId, reason: "Donasi" });

		expect(updated.quantity).toBe(15);
		expect(updated.quantityBase).toBe(15);
		const movements = await prisma.inventoryMovement.findMany({ where: { logisticsItemId: stock.id } });
		expect(movements).toHaveLength(1);
		expect(movements[0]).toMatchObject({ type: "RECEIPT", quantity: 5, baseQuantity: 5, baseUnit: "pcs", reason: "Donasi", createdById: userId });
	});

	it("RECEIPT ke item rusak membuat item pengganti, item lama tidak berubah", async () => {
		const stock = await createItem(campId, { quantity: 10 });
		await damageStock({ logisticsItemId: stock.id, quantity: 2, createdById: userId, reason: "Basah" });

		const replacement = await receiveStock({ logisticsItemId: stock.id, quantity: 4, createdById: userId });

		expect(replacement.id).not.toBe(stock.id);
		expect(replacement).toMatchObject({ itemName: "Beras", quantity: 4, damagedQuantity: 0, status: "SUFFICIENT" });
		const original = await item(stock.id);
		expect(original).toMatchObject({ quantity: 8, damagedQuantity: 2, status: "SPOILED_OR_DAMAGED" });
	});

	it("DAMAGE memindahkan stok tersedia ke rusak", async () => {
		const stock = await createItem(campId, { quantity: 10 });
		const updated = await damageStock({ logisticsItemId: stock.id, quantity: 3, createdById: userId, reason: "Bocor" });

		expect(updated).toMatchObject({ quantity: 7, quantityBase: 7, damagedQuantity: 3, damagedQuantityBase: 3, status: "SPOILED_OR_DAMAGED" });
	});

	it("DAMAGE melebihi stok tersedia ditolak tanpa mengubah data", async () => {
		const stock = await createItem(campId, { quantity: 3 });
		await expect(damageStock({ logisticsItemId: stock.id, quantity: 4, createdById: userId, reason: "x" })).rejects.toThrow("INSUFFICIENT_AVAILABLE_STOCK");

		expect(await item(stock.id)).toMatchObject({ quantity: 3, damagedQuantity: 0 });
		expect(await prisma.inventoryMovement.count()).toBe(0);
	});

	it("DAMAGE/LOSS/RESTORE/DISPOSE wajib alasan", async () => {
		const stock = await createItem(campId);
		const input = { logisticsItemId: stock.id, quantity: 1, createdById: userId, reason: "  " };
		await expect(damageStock(input)).rejects.toThrow("MOVEMENT_REASON_REQUIRED");
		await expect(recordLoss(input)).rejects.toThrow("MOVEMENT_REASON_REQUIRED");
		await expect(restoreStock(input)).rejects.toThrow("MOVEMENT_REASON_REQUIRED");
		await expect(disposeStock(input)).rejects.toThrow("MOVEMENT_REASON_REQUIRED");
	});

	it("LOSS mengurangi stok tanpa menambah stok rusak", async () => {
		const stock = await createItem(campId, { quantity: 10 });
		const updated = await recordLoss({ logisticsItemId: stock.id, quantity: 4, createdById: userId, reason: "Hilang" });

		expect(updated).toMatchObject({ quantity: 6, damagedQuantity: 0, status: "SUFFICIENT" });
	});

	it("RESTORE mengembalikan stok rusak dan ditolak bila melebihi jumlah rusak", async () => {
		const stock = await createItem(campId, { quantity: 10 });
		await damageStock({ logisticsItemId: stock.id, quantity: 3, createdById: userId, reason: "Basah" });

		await expect(restoreStock({ logisticsItemId: stock.id, quantity: 4, createdById: userId, reason: "x" })).rejects.toThrow("RESTORE_QUANTITY_EXCEEDS_DAMAGED");
		const restored = await restoreStock({ logisticsItemId: stock.id, quantity: 3, createdById: userId, reason: "Sudah kering" });

		expect(restored).toMatchObject({ quantity: 10, damagedQuantity: 0, status: "SUFFICIENT" });
	});

	it("DISPOSE membuang stok rusak dan ditolak bila melebihi jumlah rusak", async () => {
		const stock = await createItem(campId, { quantity: 10 });
		await damageStock({ logisticsItemId: stock.id, quantity: 3, createdById: userId, reason: "Basah" });

		await expect(disposeStock({ logisticsItemId: stock.id, quantity: 4, createdById: userId, reason: "x" })).rejects.toThrow("DISPOSE_QUANTITY_EXCEEDS_DAMAGED");
		const disposed = await disposeStock({ logisticsItemId: stock.id, quantity: 3, createdById: userId, reason: "Busuk" });

		expect(disposed).toMatchObject({ quantity: 7, damagedQuantity: 0, damagedQuantityBase: 0, status: "SUFFICIENT" });
		const types = (await prisma.inventoryMovement.findMany({ where: { logisticsItemId: stock.id }, orderBy: { createdAt: "asc" } })).map((m) => m.type);
		expect(types).toEqual(["DAMAGE", "DISPOSE"]);
	});

	it("status operasional mengikuti ambang minimum", async () => {
		const stock = await createItem(campId, { quantity: 10, minimumQuantity: 5 });

		expect((await recordLoss({ logisticsItemId: stock.id, quantity: 5, createdById: userId, reason: "x" })).status).toBe("LOW");
		expect((await recordLoss({ logisticsItemId: stock.id, quantity: 5, createdById: userId, reason: "x" })).status).toBe("CRITICAL");
		expect((await receiveStock({ logisticsItemId: stock.id, quantity: 20, createdById: userId })).status).toBe("SUFFICIENT");
	});

	it("posko CLOSED menolak pergerakan stok", async () => {
		const closed = await createCamp({ status: "CLOSED" });
		const stock = await createItem(closed.id);

		await expect(receiveStock({ logisticsItemId: stock.id, quantity: 1, createdById: userId })).rejects.toThrow("CAMP_NOT_ACTIVE");
		await expect(damageStock({ logisticsItemId: stock.id, quantity: 1, createdById: userId, reason: "x" })).rejects.toThrow("CAMP_NOT_ACTIVE");
	});

	it("item tidak ada dan kuantitas tidak valid ditolak", async () => {
		await expect(receiveStock({ logisticsItemId: "tidak-ada", quantity: 1, createdById: userId })).rejects.toThrow("LOGISTICS_ITEM_NOT_FOUND");
		const stock = await createItem(campId);
		await expect(receiveStock({ logisticsItemId: stock.id, quantity: 0, createdById: userId })).rejects.toThrow("INVALID_QUANTITY");
		await expect(receiveStock({ logisticsItemId: stock.id, quantity: 1.5, createdById: userId })).rejects.toThrow("INVALID_QUANTITY");
	});

	it("DAMAGE paralel tidak membuat stok negatif", async () => {
		const stock = await createItem(campId, { quantity: 5 });
		const results = await Promise.allSettled(
			Array.from({ length: 4 }, () => damageStock({ logisticsItemId: stock.id, quantity: 2, createdById: userId, reason: "x" })),
		);

		const succeeded = results.filter((result) => result.status === "fulfilled").length;
		// Retry bisa habis (P2034_EXHAUSTED), tapi invariant stok wajib tetap terjaga.
		expect(succeeded).toBeGreaterThanOrEqual(1);
		expect(succeeded).toBeLessThanOrEqual(2);
		for (const result of results) {
			if (result.status === "rejected") expect(String(result.reason)).toMatch(/INSUFFICIENT_AVAILABLE_STOCK|P2034|could not serialize/);
		}
		expect(await item(stock.id)).toMatchObject({ quantity: 5 - 2 * succeeded, damagedQuantity: 2 * succeeded });
		expect(await prisma.inventoryMovement.count({ where: { type: "DAMAGE" } })).toBe(succeeded);
	});
});
