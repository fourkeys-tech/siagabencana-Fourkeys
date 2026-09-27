import { InventoryMovementType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Transaction = Prisma.TransactionClient;
type StockInput = { logisticsItemId: string; quantity: number; createdById: string; reason?: string };
type DistributionInput = { distributionId: string; createdById: string; reason?: string };

function assertPositiveInteger(quantity: number) {
	if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("INVALID_QUANTITY");
}

async function recordMovement(tx: Transaction, input: { logisticsItemId: string; campId: string; type: InventoryMovementType; quantity: number; createdById?: string; distributionId?: string; reason?: string }) {
	await tx.inventoryMovement.create({ data: { ...input, reason: input.reason?.trim() || null } });
}

async function refreshOperationalStatus(tx: Transaction, logisticsItemId: string) {
	await tx.$executeRaw`
		UPDATE "LogisticsItem"
		SET "status" = CASE
			WHEN "status" = 'SPOILED_OR_DAMAGED'::"ItemStatus" THEN "status"
			WHEN "quantity" - "reservedQuantity" <= 0 THEN 'CRITICAL'::"ItemStatus"
			WHEN "minimumQuantity" > 0 AND "quantity" - "reservedQuantity" <= "minimumQuantity" THEN 'LOW'::"ItemStatus"
			ELSE 'SUFFICIENT'::"ItemStatus"
		END,
		"updatedAt" = CURRENT_TIMESTAMP
		WHERE "id" = ${logisticsItemId}
	`;
}

async function runSerializable<T>(operation: (tx: Transaction) => Promise<T>) {
	return prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function receiveStock(input: StockInput) {
	assertPositiveInteger(input.quantity);
	return runSerializable(async (tx) => {
		const item = await tx.logisticsItem.findUnique({ where: { id: input.logisticsItemId } });
		if (!item) throw new Error("LOGISTICS_ITEM_NOT_FOUND");
		await tx.logisticsItem.update({ where: { id: item.id }, data: { quantity: { increment: input.quantity } } });
		await refreshOperationalStatus(tx, item.id);
		await recordMovement(tx, { logisticsItemId: item.id, campId: item.campId, type: "RECEIPT", quantity: input.quantity, createdById: input.createdById, reason: input.reason });
		return tx.logisticsItem.findUniqueOrThrow({ where: { id: item.id } });
	});
}

async function adjustOutOfStock(input: StockInput, type: "DAMAGE" | "LOSS") {
	assertPositiveInteger(input.quantity);
	if (!input.reason?.trim()) throw new Error("MOVEMENT_REASON_REQUIRED");
	return runSerializable(async (tx) => {
		const changed = await tx.$executeRaw`
			UPDATE "LogisticsItem"
			SET "quantity" = "quantity" - ${input.quantity},
				"damagedQuantity" = "damagedQuantity" + ${type === "DAMAGE" ? input.quantity : 0},
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE "id" = ${input.logisticsItemId}
				AND "quantity" - "reservedQuantity" >= ${input.quantity}
		`;
		if (changed !== 1) {
			const exists = await tx.logisticsItem.findUnique({ where: { id: input.logisticsItemId }, select: { id: true } });
			if (!exists) throw new Error("LOGISTICS_ITEM_NOT_FOUND");
			throw new Error("INSUFFICIENT_AVAILABLE_STOCK");
		}
		const item = await tx.logisticsItem.findUniqueOrThrow({ where: { id: input.logisticsItemId } });
		await refreshOperationalStatus(tx, item.id);
		await recordMovement(tx, { logisticsItemId: item.id, campId: item.campId, type, quantity: input.quantity, createdById: input.createdById, reason: input.reason });
		return item;
	});
}

export async function damageStock(input: StockInput) { return adjustOutOfStock(input, "DAMAGE"); }
export async function recordLoss(input: StockInput) { return adjustOutOfStock(input, "LOSS"); }

async function reserveDistributionInTransaction(tx: Transaction, input: { distributionId: string; createdById: string; reason?: string }) {
	const distribution = await tx.distribution.findUnique({ where: { id: input.distributionId } });
	if (!distribution) throw new Error("DISTRIBUTION_NOT_FOUND");
	if (distribution.status !== "APPROVED") throw new Error("INVALID_DISTRIBUTION_STATUS");
	if (!distribution.sourceItemId) throw new Error("SOURCE_STOCK_NOT_FOUND");
	const reserved = await tx.$executeRaw`
		UPDATE "LogisticsItem"
		SET "reservedQuantity" = "reservedQuantity" + ${distribution.quantity}, "updatedAt" = CURRENT_TIMESTAMP
		WHERE "id" = ${distribution.sourceItemId} AND "campId" = ${distribution.sourceCampId}
		AND "quantity" - "reservedQuantity" >= ${distribution.quantity}
	`;
	if (reserved !== 1) throw new Error("INSUFFICIENT_AVAILABLE_STOCK");
	const changed = await tx.distribution.updateMany({ where: { id: distribution.id, status: "APPROVED" }, data: { status: "RESERVED" } });
	if (changed.count !== 1) throw new Error("INVALID_DISTRIBUTION_STATUS");
	await tx.logisticsRequest.updateMany({ where: { id: distribution.requestId, status: "APPROVED" }, data: { status: "RESERVED" } });
	await refreshOperationalStatus(tx, distribution.sourceItemId);
	await recordMovement(tx, { logisticsItemId: distribution.sourceItemId, campId: distribution.sourceCampId, type: "RESERVATION", quantity: distribution.quantity, createdById: input.createdById, distributionId: distribution.id, reason: input.reason ?? "Distribusi disetujui" });
	return distribution;
}

export async function approveAndReserveDistribution(input: { requestId: string; sourceItemId: string; quantity: number; createdById: string }) {
	assertPositiveInteger(input.quantity);
	return runSerializable(async (tx) => {
		const request = await tx.logisticsRequest.findUnique({ where: { id: input.requestId } });
		if (!request) throw new Error("DISTRIBUTION_REQUEST_NOT_FOUND");
		if (request.status !== "PENDING") throw new Error("INVALID_REQUEST_STATUS");
		if (input.quantity > request.quantity) throw new Error("QUANTITY_EXCEEDS_REQUEST");
		const sourceItem = await tx.logisticsItem.findUnique({ where: { id: input.sourceItemId } });
		if (!sourceItem || sourceItem.status === "SPOILED_OR_DAMAGED" || sourceItem.campId !== request.sourceCampId || sourceItem.itemName.toLowerCase() !== request.itemName.toLowerCase() || sourceItem.unit.toLowerCase() !== request.unit.toLowerCase()) throw new Error("SOURCE_STOCK_MISMATCH");
		const locked = await tx.logisticsRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { status: "APPROVED", reviewedById: input.createdById } });
		if (locked.count !== 1) throw new Error("INVALID_REQUEST_STATUS");
		const distribution = await tx.distribution.create({ data: { requestId: request.id, sourceCampId: request.sourceCampId, destinationCampId: request.destinationCampId, sourceItemId: sourceItem.id, createdById: input.createdById, itemName: request.itemName, quantity: input.quantity, unit: request.unit, notes: request.notes, status: "APPROVED" } });
		await reserveDistributionInTransaction(tx, { distributionId: distribution.id, createdById: input.createdById });
		return tx.distribution.findUniqueOrThrow({ where: { id: distribution.id }, include: { sourceCamp: true, destinationCamp: true } });
	});
}

export async function reserveStock(input: DistributionInput) {
	return runSerializable((tx) => reserveDistributionInTransaction(tx, input));
}

export async function releaseReservation(input: DistributionInput) {
	return runSerializable(async (tx) => {
		const distribution = await tx.distribution.findUnique({ where: { id: input.distributionId } });
		if (!distribution) throw new Error("DISTRIBUTION_NOT_FOUND");
		if (distribution.status !== "RESERVED") throw new Error("INVALID_DISTRIBUTION_STATUS");
		if (!distribution.sourceItemId) throw new Error("SOURCE_STOCK_NOT_FOUND");
		const released = await tx.$executeRaw`
			UPDATE "LogisticsItem" SET "reservedQuantity" = "reservedQuantity" - ${distribution.quantity}, "updatedAt" = CURRENT_TIMESTAMP
			WHERE "id" = ${distribution.sourceItemId} AND "reservedQuantity" >= ${distribution.quantity}
		`;
		if (released !== 1) throw new Error("RESERVATION_NOT_FOUND");
		const changed = await tx.distribution.updateMany({ where: { id: distribution.id, status: "RESERVED" }, data: { status: "CANCELLED" } });
		if (changed.count !== 1) throw new Error("INVALID_DISTRIBUTION_STATUS");
		await tx.logisticsRequest.updateMany({ where: { id: distribution.requestId, status: "RESERVED" }, data: { status: "CANCELLED" } });
		await refreshOperationalStatus(tx, distribution.sourceItemId);
		await recordMovement(tx, { logisticsItemId: distribution.sourceItemId, campId: distribution.sourceCampId, type: "RESERVATION_RELEASE", quantity: distribution.quantity, createdById: input.createdById, distributionId: distribution.id, reason: input.reason ?? "Distribusi dibatalkan sebelum dikirim" });
		return tx.distribution.findUniqueOrThrow({ where: { id: distribution.id } });
	});
}

export async function shipStock(input: DistributionInput) {
	return runSerializable(async (tx) => {
		const distribution = await tx.distribution.findUnique({ where: { id: input.distributionId } });
		if (!distribution) throw new Error("DISTRIBUTION_NOT_FOUND");
		if (distribution.status !== "RESERVED") throw new Error("INVALID_DISTRIBUTION_STATUS");
		if (!distribution.sourceItemId) throw new Error("SOURCE_STOCK_NOT_FOUND");
		const shipped = await tx.$executeRaw`
			UPDATE "LogisticsItem" SET "quantity" = "quantity" - ${distribution.quantity}, "reservedQuantity" = "reservedQuantity" - ${distribution.quantity}, "updatedAt" = CURRENT_TIMESTAMP
			WHERE "id" = ${distribution.sourceItemId} AND "campId" = ${distribution.sourceCampId}
			AND "reservedQuantity" >= ${distribution.quantity} AND "quantity" >= ${distribution.quantity}
		`;
		if (shipped !== 1) throw new Error("RESERVATION_NOT_FOUND");
		const changed = await tx.distribution.updateMany({ where: { id: distribution.id, status: "RESERVED" }, data: { status: "SHIPPED", shippedAt: new Date() } });
		if (changed.count !== 1) throw new Error("INVALID_DISTRIBUTION_STATUS");
		await tx.logisticsRequest.updateMany({ where: { id: distribution.requestId, status: "RESERVED" }, data: { status: "SHIPPED" } });
		await refreshOperationalStatus(tx, distribution.sourceItemId);
		await recordMovement(tx, { logisticsItemId: distribution.sourceItemId, campId: distribution.sourceCampId, type: "DISTRIBUTION_OUT", quantity: distribution.quantity, createdById: input.createdById, distributionId: distribution.id, reason: input.reason ?? "Distribusi dikirim" });
		return tx.distribution.findUniqueOrThrow({ where: { id: distribution.id } });
	});
}

export async function receiveDistribution(input: DistributionInput) {
	return runSerializable(async (tx) => {
		const distribution = await tx.distribution.findUnique({ where: { id: input.distributionId } });
		if (!distribution) throw new Error("DISTRIBUTION_NOT_FOUND");
		if (distribution.status !== "SHIPPED") throw new Error("INVALID_DISTRIBUTION_STATUS");
		const changed = await tx.distribution.updateMany({ where: { id: distribution.id, status: "SHIPPED" }, data: { status: "RECEIVED", receivedAt: new Date() } });
		if (changed.count !== 1) throw new Error("INVALID_DISTRIBUTION_STATUS");
		await tx.logisticsRequest.updateMany({ where: { id: distribution.requestId, status: "SHIPPED" }, data: { status: "RECEIVED" } });
		let target = await tx.logisticsItem.findFirst({ where: { campId: distribution.destinationCampId, itemName: distribution.itemName, unit: distribution.unit } });
		if (!target) target = await tx.logisticsItem.create({ data: { campId: distribution.destinationCampId, itemName: distribution.itemName, quantity: 0, unit: distribution.unit, status: "SUFFICIENT", notes: distribution.notes } });
		await tx.logisticsItem.update({ where: { id: target.id }, data: { quantity: { increment: distribution.quantity } } });
		await refreshOperationalStatus(tx, target.id);
		await recordMovement(tx, { logisticsItemId: target.id, campId: distribution.destinationCampId, type: "DISTRIBUTION_IN", quantity: distribution.quantity, createdById: input.createdById, distributionId: distribution.id, reason: input.reason ?? "Distribusi diterima" });
		return tx.distribution.findUniqueOrThrow({ where: { id: distribution.id } });
	});
}
