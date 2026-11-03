import { afterAll, beforeEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { approveAndReserveDistribution, damageStock, receiveDistribution, releaseReservation, shipStock } from "@/lib/inventory";
import { createCamp, createItem, createRequest, createUser, describeDb, item, resetDatabase } from "./helpers";

async function statuses(requestId: string) {
	const request = await prisma.logisticsRequest.findUniqueOrThrow({ where: { id: requestId }, include: { distribution: true } });
	return { request: request.status, distribution: request.distribution?.status ?? null };
}

describeDb("distribution workflow", () => {
	let sourceId: string;
	let destinationId: string;
	let adminId: string;

	beforeEach(async () => {
		await resetDatabase();
		sourceId = (await createCamp({ name: "Asal" })).id;
		destinationId = (await createCamp({ name: "Tujuan" })).id;
		adminId = (await createUser()).id;
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("approve → ship → receive memindahkan stok dan menjaga status request/distribusi sinkron", async () => {
		const stock = await createItem(sourceId, { quantity: 20 });
		const request = await createRequest({ sourceCampId: sourceId, destinationCampId: destinationId, createdById: adminId, quantity: 8 });

		const approved = await approveAndReserveDistribution({ requestId: request.id, sourceItemId: stock.id, quantity: 8, createdById: adminId });
		expect(approved.status).toBe("RESERVED");
		expect(await statuses(request.id)).toEqual({ request: "RESERVED", distribution: "RESERVED" });
		expect(await item(stock.id)).toMatchObject({ quantity: 20, reservedQuantity: 8, reservedQuantityBase: 8 });

		await shipStock({ distributionId: approved.id, createdById: adminId });
		expect(await statuses(request.id)).toEqual({ request: "SHIPPED", distribution: "SHIPPED" });
		expect(await item(stock.id)).toMatchObject({ quantity: 12, reservedQuantity: 0 });

		await receiveDistribution({ distributionId: approved.id, createdById: adminId, receiptProofData: "data:image/png;base64,AA==", receiptProofName: "bukti.png", receiptProofMimeType: "image/png" });
		expect(await statuses(request.id)).toEqual({ request: "RECEIVED", distribution: "RECEIVED" });

		const target = await prisma.logisticsItem.findFirstOrThrow({ where: { campId: destinationId, itemName: "Beras" } });
		expect(target).toMatchObject({ quantity: 8, quantityBase: 8, status: "SUFFICIENT" });
		const distribution = await prisma.distribution.findUniqueOrThrow({ where: { id: approved.id } });
		expect(distribution.receiptProofMimeType).toBe("image/png");
		expect(distribution.receivedAt).not.toBeNull();

		const ledger = (await prisma.inventoryMovement.findMany({ where: { distributionId: approved.id }, orderBy: { createdAt: "asc" } })).map((m) => m.type);
		expect(ledger).toEqual(["RESERVATION", "DISTRIBUTION_OUT", "DISTRIBUTION_IN"]);
	});

	it("receive menambah ke item tujuan yang sudah ada", async () => {
		const stock = await createItem(sourceId, { quantity: 10 });
		const existing = await createItem(destinationId, { quantity: 3 });
		const request = await createRequest({ sourceCampId: sourceId, destinationCampId: destinationId, createdById: adminId, quantity: 5 });

		const approved = await approveAndReserveDistribution({ requestId: request.id, sourceItemId: stock.id, quantity: 5, createdById: adminId });
		await shipStock({ distributionId: approved.id, createdById: adminId });
		await receiveDistribution({ distributionId: approved.id, createdById: adminId });

		expect(await item(existing.id)).toMatchObject({ quantity: 8 });
		expect(await prisma.logisticsItem.count({ where: { campId: destinationId } })).toBe(1);
	});

	it("cancel melepas reservasi dan membatalkan request", async () => {
		const stock = await createItem(sourceId, { quantity: 10 });
		const request = await createRequest({ sourceCampId: sourceId, destinationCampId: destinationId, createdById: adminId, quantity: 4 });
		const approved = await approveAndReserveDistribution({ requestId: request.id, sourceItemId: stock.id, quantity: 4, createdById: adminId });

		await releaseReservation({ distributionId: approved.id, createdById: adminId });

		expect(await statuses(request.id)).toEqual({ request: "CANCELLED", distribution: "CANCELLED" });
		expect(await item(stock.id)).toMatchObject({ quantity: 10, reservedQuantity: 0, reservedQuantityBase: 0 });
	});

	it("transisi di luar alur ditolak", async () => {
		const stock = await createItem(sourceId, { quantity: 10 });
		const request = await createRequest({ sourceCampId: sourceId, destinationCampId: destinationId, createdById: adminId, quantity: 4 });
		const approved = await approveAndReserveDistribution({ requestId: request.id, sourceItemId: stock.id, quantity: 4, createdById: adminId });

		await expect(receiveDistribution({ distributionId: approved.id, createdById: adminId })).rejects.toThrow("INVALID_DISTRIBUTION_STATUS");
		await expect(approveAndReserveDistribution({ requestId: request.id, sourceItemId: stock.id, quantity: 4, createdById: adminId })).rejects.toThrow("INVALID_REQUEST_STATUS");
		await shipStock({ distributionId: approved.id, createdById: adminId });
		await expect(releaseReservation({ distributionId: approved.id, createdById: adminId })).rejects.toThrow("INVALID_DISTRIBUTION_STATUS");
		await expect(shipStock({ distributionId: approved.id, createdById: adminId })).rejects.toThrow("INVALID_DISTRIBUTION_STATUS");
	});

	it("approve ditolak untuk stok tidak cocok, rusak, kurang, atau melebihi permintaan", async () => {
		const request = await createRequest({ sourceCampId: sourceId, destinationCampId: destinationId, createdById: adminId, quantity: 5 });
		const otherName = await createItem(sourceId, { itemName: "Air", quantity: 10 });
		const otherCamp = await createItem(destinationId, { quantity: 10 });
		const damaged = await createItem(sourceId, { quantity: 10 });
		await damageStock({ logisticsItemId: damaged.id, quantity: 1, createdById: adminId, reason: "x" });
		const small = await createItem(sourceId, { quantity: 2 });

		const approve = (sourceItemId: string, quantity = 5) => approveAndReserveDistribution({ requestId: request.id, sourceItemId, quantity, createdById: adminId });
		await expect(approve(otherName.id)).rejects.toThrow("SOURCE_STOCK_MISMATCH");
		await expect(approve(otherCamp.id)).rejects.toThrow("SOURCE_STOCK_MISMATCH");
		await expect(approve(damaged.id)).rejects.toThrow("SOURCE_STOCK_MISMATCH");
		await expect(approve(small.id, 6)).rejects.toThrow("QUANTITY_EXCEEDS_REQUEST");
		await expect(approve(small.id)).rejects.toThrow("INSUFFICIENT_AVAILABLE_STOCK");

		// Gagal di dalam transaksi tidak boleh meninggalkan status setengah jadi.
		expect(await statuses(request.id)).toEqual({ request: "PENDING", distribution: null });
		expect(await item(small.id)).toMatchObject({ reservedQuantity: 0 });
	});

	it("approve ditolak bila posko asal atau tujuan ditutup", async () => {
		const stock = await createItem(sourceId, { quantity: 10 });
		const request = await createRequest({ sourceCampId: sourceId, destinationCampId: destinationId, createdById: adminId, quantity: 2 });
		await prisma.camp.update({ where: { id: destinationId }, data: { status: "CLOSED" } });

		await expect(approveAndReserveDistribution({ requestId: request.id, sourceItemId: stock.id, quantity: 2, createdById: adminId })).rejects.toThrow("CAMP_NOT_ACTIVE");
	});

	it("reservasi paralel tidak melebihi stok tersedia", async () => {
		const stock = await createItem(sourceId, { quantity: 10 });
		const requests = await Promise.all(
			Array.from({ length: 3 }, () => createRequest({ sourceCampId: sourceId, destinationCampId: destinationId, createdById: adminId, quantity: 6 })),
		);

		const results = await Promise.allSettled(
			requests.map((request) => approveAndReserveDistribution({ requestId: request.id, sourceItemId: stock.id, quantity: 6, createdById: adminId })),
		);

		const succeeded = results.filter((result) => result.status === "fulfilled").length;
		expect(succeeded).toBe(1);
		expect(await item(stock.id)).toMatchObject({ reservedQuantity: 6 });
		expect(await prisma.distribution.count()).toBe(1);
	});
});
