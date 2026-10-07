import { Prisma } from "@prisma/client";
import type { InventoryMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { convertBaseToStock, convertToBase, type UnitDefinition } from "@/lib/unit-conversion";

type Transaction = Prisma.TransactionClient;
type InventoryMovementKind = "RECEIPT" | "DAMAGE" | "LOSS" | "RESTORE" | "DISPOSE" | "RESERVATION" | "RESERVATION_RELEASE" | "DISTRIBUTION_OUT" | "DISTRIBUTION_IN";
type UnitDimension = "COUNT" | "MASS" | "VOLUME";
type ConversionStatus = "CONFIGURED" | "NEEDS_REVIEW";

type ItemUnitFields = {
	unit: string;
	baseUnit: string;
	unitDimension: UnitDimension;
	conversionFactor: number;
	conversionStatus: ConversionStatus;
};

type StockInput = { logisticsItemId: string; quantity: number; createdById: string; reason?: string };
type DistributionInput = {
	distributionId: string;
	createdById: string;
	reason?: string;
	receiptProofData?: string;
	receiptProofName?: string;
	receiptProofMimeType?: string;
};

const movementType = (type: InventoryMovementKind) => type as InventoryMovementType;

function itemUnitDefinition(item: ItemUnitFields): UnitDefinition {
	return {
		unit: item.unit,
		baseUnit: item.baseUnit,
		unitDimension: item.unitDimension,
		conversionFactor: item.conversionFactor,
		conversionStatus: item.conversionStatus,
	};
}

function baseQuantityFor(item: ItemUnitFields, quantity: number) {
	return convertToBase(quantity, itemUnitDefinition(item));
}

function assertPositiveInteger(quantity: number) {
	if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("INVALID_QUANTITY");
}

async function recordMovement(tx: Transaction, input: {
	logisticsItemId: string;
	campId: string;
	type: InventoryMovementType;
	quantity: number;
	baseQuantity?: number;
	unitFields: ItemUnitFields;
	createdById?: string;
	distributionId?: string;
	reason?: string;
}) {
	const baseQuantity = input.baseQuantity ?? baseQuantityFor(input.unitFields, input.quantity);
	await tx.inventoryMovement.create({
		data: {
			logisticsItemId: input.logisticsItemId,
			campId: input.campId,
			type: input.type,
			quantity: input.quantity,
			baseQuantity,
			baseUnit: input.unitFields.baseUnit,
			unitDimension: input.unitFields.unitDimension,
			conversionFactor: input.unitFields.conversionFactor,
			createdById: input.createdById,
			distributionId: input.distributionId,
			reason: input.reason?.trim() || "Pergerakan stok",
		},
	});
}

async function refreshOperationalStatus(tx: Transaction, logisticsItemId: string) {
	await tx.$executeRaw`
		UPDATE "LogisticsItem"
		SET "status" = CASE
			WHEN "damagedQuantityBase" > 0 THEN 'SPOILED_OR_DAMAGED'::"ItemStatus"
			WHEN "quantityBase" - "reservedQuantityBase" <= 0 THEN 'CRITICAL'::"ItemStatus"
			WHEN "minimumQuantityBase" > 0 AND "quantityBase" - "reservedQuantityBase" <= "minimumQuantityBase" THEN 'LOW'::"ItemStatus"
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
		const unitFields = itemUnitDefinition(item);
		const baseQuantity = baseQuantityFor(item, input.quantity);

		if (item.status === "SPOILED_OR_DAMAGED" || item.damagedQuantity > 0 || item.damagedQuantityBase > 0) {
			const replacement = await tx.logisticsItem.create({
				data: {
					campId: item.campId,
					itemName: item.itemName,
					quantity: input.quantity,
					reservedQuantity: 0,
					damagedQuantity: 0,
					minimumQuantity: item.minimumQuantity,
					unit: item.unit,
					baseUnit: item.baseUnit,
					unitDimension: item.unitDimension,
					conversionFactor: item.conversionFactor,
					conversionStatus: item.conversionStatus,
					conversionNote: item.conversionNote,
					quantityBase: baseQuantity,
					reservedQuantityBase: 0,
					damagedQuantityBase: 0,
					minimumQuantityBase: item.minimumQuantityBase,
					status: "SUFFICIENT",
					notes: input.reason?.trim() || `Stok pengganti untuk ${item.itemName}`,
				},
			});
			await refreshOperationalStatus(tx, replacement.id);
			await recordMovement(tx, { logisticsItemId: replacement.id, campId: replacement.campId, type: movementType("RECEIPT"), quantity: input.quantity, baseQuantity, unitFields, createdById: input.createdById, reason: input.reason ?? "Stok pengganti" });
			return tx.logisticsItem.findUniqueOrThrow({ where: { id: replacement.id } });
		}

		await tx.logisticsItem.update({ where: { id: item.id }, data: { quantity: { increment: input.quantity }, quantityBase: { increment: baseQuantity } } });
		await refreshOperationalStatus(tx, item.id);
		await recordMovement(tx, { logisticsItemId: item.id, campId: item.campId, type: movementType("RECEIPT"), quantity: input.quantity, baseQuantity, unitFields, createdById: input.createdById, reason: input.reason });
		return tx.logisticsItem.findUniqueOrThrow({ where: { id: item.id } });
	});
}

async function adjustOutOfStock(input: StockInput, type: "DAMAGE" | "LOSS") {
	assertPositiveInteger(input.quantity);
	if (!input.reason?.trim()) throw new Error("MOVEMENT_REASON_REQUIRED");
	return runSerializable(async (tx) => {
		const item = await tx.logisticsItem.findUnique({ where: { id: input.logisticsItemId } });
		if (!item) throw new Error("LOGISTICS_ITEM_NOT_FOUND");
		const unitFields = itemUnitDefinition(item);
		const baseQuantity = baseQuantityFor(item, input.quantity);
		const damagedDisplayIncrement = type === "DAMAGE" ? input.quantity : 0;
		const damagedBaseIncrement = type === "DAMAGE" ? baseQuantity : 0;
		const changed = await tx.$executeRaw`
			UPDATE "LogisticsItem"
			SET "quantity" = "quantity" - ${input.quantity},
				"quantityBase" = "quantityBase" - ${baseQuantity},
				"damagedQuantity" = "damagedQuantity" + ${damagedDisplayIncrement},
				"damagedQuantityBase" = "damagedQuantityBase" + ${damagedBaseIncrement},
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE "id" = ${input.logisticsItemId}
				AND "quantity" - "reservedQuantity" >= ${input.quantity}
				AND "quantityBase" - "reservedQuantityBase" >= ${baseQuantity}
		`;
		if (changed !== 1) throw new Error("INSUFFICIENT_AVAILABLE_STOCK");
		await refreshOperationalStatus(tx, item.id);
		const updated = await tx.logisticsItem.findUniqueOrThrow({ where: { id: item.id } });
		await recordMovement(tx, { logisticsItemId: item.id, campId: item.campId, type: movementType(type), quantity: input.quantity, baseQuantity, unitFields, createdById: input.createdById, reason: input.reason });
		return updated;
	});
}

export async function damageStock(input: StockInput) { return adjustOutOfStock(input, "DAMAGE"); }
export async function recordLoss(input: StockInput) { return adjustOutOfStock(input, "LOSS"); }

export async function restoreStock(input: StockInput) {
	assertPositiveInteger(input.quantity);
	if (!input.reason?.trim()) throw new Error("MOVEMENT_REASON_REQUIRED");
	return runSerializable(async (tx) => {
		const item = await tx.logisticsItem.findUnique({ where: { id: input.logisticsItemId } });
		if (!item) throw new Error("LOGISTICS_ITEM_NOT_FOUND");
		const unitFields = itemUnitDefinition(item);
		const baseQuantity = baseQuantityFor(item, input.quantity);
		if (item.damagedQuantity < input.quantity || item.damagedQuantityBase < baseQuantity) throw new Error("RESTORE_QUANTITY_EXCEEDS_DAMAGED");
		await tx.logisticsItem.update({
			where: { id: item.id },
			data: {
				quantity: { increment: input.quantity },
				quantityBase: { increment: baseQuantity },
				damagedQuantity: { decrement: input.quantity },
				damagedQuantityBase: { decrement: baseQuantity },
			},
		});
		await refreshOperationalStatus(tx, item.id);
		await recordMovement(tx, { logisticsItemId: item.id, campId: item.campId, type: movementType("RESTORE"), quantity: input.quantity, baseQuantity, unitFields, createdById: input.createdById, reason: input.reason });
		return tx.logisticsItem.findUniqueOrThrow({ where: { id: item.id } });
	});
}

export async function disposeStock(input: StockInput) {
	assertPositiveInteger(input.quantity);
	if (!input.reason?.trim()) throw new Error("MOVEMENT_REASON_REQUIRED");
	return runSerializable(async (tx) => {
		const item = await tx.logisticsItem.findUnique({ where: { id: input.logisticsItemId } });
		if (!item) throw new Error("LOGISTICS_ITEM_NOT_FOUND");
		const unitFields = itemUnitDefinition(item);
		const baseQuantity = baseQuantityFor(item, input.quantity);
		const changed = await tx.$executeRaw`
			UPDATE "LogisticsItem"
			SET "damagedQuantity" = "damagedQuantity" - ${input.quantity},
				"damagedQuantityBase" = "damagedQuantityBase" - ${baseQuantity},
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE "id" = ${input.logisticsItemId}
				AND "damagedQuantity" >= ${input.quantity}
				AND "damagedQuantityBase" >= ${baseQuantity}
		`;
		if (changed !== 1) throw new Error("DISPOSE_QUANTITY_EXCEEDS_DAMAGED");
		await refreshOperationalStatus(tx, item.id);
		await recordMovement(tx, { logisticsItemId: item.id, campId: item.campId, type: movementType("DISPOSE"), quantity: input.quantity, baseQuantity, unitFields, createdById: input.createdById, reason: input.reason });
		return tx.logisticsItem.findUniqueOrThrow({ where: { id: item.id } });
	});
}

async function sourceItemForDistribution(tx: Transaction, distribution: { sourceItemId: string | null; sourceCampId: string }) {
	if (!distribution.sourceItemId) throw new Error("SOURCE_STOCK_NOT_FOUND");
	const item = await tx.logisticsItem.findUnique({ where: { id: distribution.sourceItemId } });
	if (!item || item.campId !== distribution.sourceCampId) throw new Error("SOURCE_STOCK_NOT_FOUND");
	return item;
}

async function reserveDistributionInTransaction(tx: Transaction, input: { distributionId: string; createdById: string; reason?: string }) {
	const distribution = await tx.distribution.findUnique({ where: { id: input.distributionId } });
	if (!distribution) throw new Error("DISTRIBUTION_NOT_FOUND");
	if (distribution.status !== "APPROVED") throw new Error("INVALID_DISTRIBUTION_STATUS");
	const sourceItem = await sourceItemForDistribution(tx, distribution);
	const unitFields = itemUnitDefinition(sourceItem);
	const baseQuantity = distribution.baseQuantity ?? baseQuantityFor(sourceItem, distribution.quantity);
	const reserved = await tx.$executeRaw`
		UPDATE "LogisticsItem"
		SET "reservedQuantity" = "reservedQuantity" + ${distribution.quantity},
			"reservedQuantityBase" = "reservedQuantityBase" + ${baseQuantity},
			"updatedAt" = CURRENT_TIMESTAMP
		WHERE "id" = ${sourceItem.id} AND "campId" = ${distribution.sourceCampId}
		AND "quantity" - "reservedQuantity" >= ${distribution.quantity}
		AND "quantityBase" - "reservedQuantityBase" >= ${baseQuantity}
	`;
	if (reserved !== 1) throw new Error("INSUFFICIENT_AVAILABLE_STOCK");
	const changed = await tx.distribution.updateMany({ where: { id: distribution.id, status: "APPROVED" }, data: { status: "RESERVED", baseQuantity } });
	if (changed.count !== 1) throw new Error("INVALID_DISTRIBUTION_STATUS");
	await tx.logisticsRequest.updateMany({ where: { id: distribution.requestId, status: "APPROVED" }, data: { status: "RESERVED" } });
	await refreshOperationalStatus(tx, sourceItem.id);
	await recordMovement(tx, { logisticsItemId: sourceItem.id, campId: sourceItem.campId, type: movementType("RESERVATION"), quantity: distribution.quantity, baseQuantity, unitFields, createdById: input.createdById, distributionId: distribution.id, reason: input.reason ?? "Distribusi disetujui" });
	return tx.distribution.findUniqueOrThrow({ where: { id: distribution.id } });
}

export async function approveAndReserveDistribution(input: { requestId: string; sourceItemId: string; quantity: number; createdById: string }) {
	assertPositiveInteger(input.quantity);
	return runSerializable(async (tx) => {
		const request = await tx.logisticsRequest.findUnique({ where: { id: input.requestId } });
		if (!request) throw new Error("DISTRIBUTION_REQUEST_NOT_FOUND");
		if (request.status !== "PENDING") throw new Error("INVALID_REQUEST_STATUS");
		if (input.quantity > request.quantity) throw new Error("QUANTITY_EXCEEDS_REQUEST");
		const sourceItem = await tx.logisticsItem.findUnique({ where: { id: input.sourceItemId } });
		if (!sourceItem || sourceItem.status === "SPOILED_OR_DAMAGED" || sourceItem.damagedQuantity > 0 || sourceItem.campId !== request.sourceCampId || sourceItem.itemName.toLowerCase() !== request.itemName.toLowerCase() || sourceItem.unit.toLowerCase() !== request.unit.toLowerCase() || sourceItem.damagedQuantityBase > 0 || (request.baseUnit !== null && (sourceItem.baseUnit !== request.baseUnit || sourceItem.unitDimension !== request.unitDimension || sourceItem.conversionFactor !== request.conversionFactor || sourceItem.conversionStatus !== request.conversionStatus))) throw new Error("SOURCE_STOCK_MISMATCH");
		const baseQuantity = baseQuantityFor(sourceItem, input.quantity);
		const locked = await tx.logisticsRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { status: "APPROVED", reviewedById: input.createdById, baseQuantity, baseUnit: sourceItem.baseUnit, unitDimension: sourceItem.unitDimension, conversionFactor: sourceItem.conversionFactor, conversionStatus: sourceItem.conversionStatus } });
		if (locked.count !== 1) throw new Error("INVALID_REQUEST_STATUS");
		const distribution = await tx.distribution.create({ data: { requestId: request.id, sourceCampId: request.sourceCampId, destinationCampId: request.destinationCampId, sourceItemId: sourceItem.id, createdById: input.createdById, itemName: sourceItem.itemName, quantity: input.quantity, unit: sourceItem.unit, requestedQuantity: request.requestedQuantity, requestedUnit: request.requestedUnit, baseQuantity, baseUnit: sourceItem.baseUnit, unitDimension: sourceItem.unitDimension, conversionFactor: sourceItem.conversionFactor, conversionStatus: sourceItem.conversionStatus, notes: request.notes, status: "APPROVED" } });
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
		const sourceItem = await sourceItemForDistribution(tx, distribution);
		const baseQuantity = distribution.baseQuantity ?? baseQuantityFor(sourceItem, distribution.quantity);
		const released = await tx.$executeRaw`
			UPDATE "LogisticsItem"
			SET "reservedQuantity" = "reservedQuantity" - ${distribution.quantity},
				"reservedQuantityBase" = "reservedQuantityBase" - ${baseQuantity},
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE "id" = ${sourceItem.id} AND "reservedQuantity" >= ${distribution.quantity} AND "reservedQuantityBase" >= ${baseQuantity}
		`;
		if (released !== 1) throw new Error("RESERVATION_NOT_FOUND");
		const changed = await tx.distribution.updateMany({ where: { id: distribution.id, status: "RESERVED" }, data: { status: "CANCELLED" } });
		if (changed.count !== 1) throw new Error("INVALID_DISTRIBUTION_STATUS");
		await tx.logisticsRequest.updateMany({ where: { id: distribution.requestId, status: "RESERVED" }, data: { status: "CANCELLED" } });
		await refreshOperationalStatus(tx, sourceItem.id);
		await recordMovement(tx, { logisticsItemId: sourceItem.id, campId: sourceItem.campId, type: movementType("RESERVATION_RELEASE"), quantity: distribution.quantity, baseQuantity, unitFields: itemUnitDefinition(sourceItem), createdById: input.createdById, distributionId: distribution.id, reason: input.reason ?? "Distribusi dibatalkan sebelum dikirim" });
		return tx.distribution.findUniqueOrThrow({ where: { id: distribution.id } });
	});
}

export async function shipStock(input: DistributionInput) {
	return runSerializable(async (tx) => {
		const distribution = await tx.distribution.findUnique({ where: { id: input.distributionId } });
		if (!distribution) throw new Error("DISTRIBUTION_NOT_FOUND");
		if (distribution.status !== "RESERVED") throw new Error("INVALID_DISTRIBUTION_STATUS");
		const sourceItem = await sourceItemForDistribution(tx, distribution);
		const baseQuantity = distribution.baseQuantity ?? baseQuantityFor(sourceItem, distribution.quantity);
		const shipped = await tx.$executeRaw`
			UPDATE "LogisticsItem"
			SET "quantity" = "quantity" - ${distribution.quantity},
				"quantityBase" = "quantityBase" - ${baseQuantity},
				"reservedQuantity" = "reservedQuantity" - ${distribution.quantity},
				"reservedQuantityBase" = "reservedQuantityBase" - ${baseQuantity},
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE "id" = ${sourceItem.id} AND "campId" = ${distribution.sourceCampId}
			AND "reservedQuantity" >= ${distribution.quantity} AND "reservedQuantityBase" >= ${baseQuantity}
			AND "quantity" >= ${distribution.quantity} AND "quantityBase" >= ${baseQuantity}
		`;
		if (shipped !== 1) throw new Error("RESERVATION_NOT_FOUND");
		const changed = await tx.distribution.updateMany({ where: { id: distribution.id, status: "RESERVED" }, data: { status: "SHIPPED", shippedAt: new Date() } });
		if (changed.count !== 1) throw new Error("INVALID_DISTRIBUTION_STATUS");
		await tx.logisticsRequest.updateMany({ where: { id: distribution.requestId, status: "RESERVED" }, data: { status: "SHIPPED" } });
		await refreshOperationalStatus(tx, sourceItem.id);
		await recordMovement(tx, { logisticsItemId: sourceItem.id, campId: sourceItem.campId, type: movementType("DISTRIBUTION_OUT"), quantity: distribution.quantity, baseQuantity, unitFields: itemUnitDefinition(sourceItem), createdById: input.createdById, distributionId: distribution.id, reason: input.reason ?? "Distribusi dikirim" });
		return tx.distribution.findUniqueOrThrow({ where: { id: distribution.id } });
	});
}

export async function receiveDistribution(input: DistributionInput) {
	return runSerializable(async (tx) => {
		const distribution = await tx.distribution.findUnique({ where: { id: input.distributionId } });
		if (!distribution) throw new Error("DISTRIBUTION_NOT_FOUND");
		if (distribution.status !== "SHIPPED") throw new Error("INVALID_DISTRIBUTION_STATUS");
		const baseQuantity = distribution.baseQuantity ?? distribution.quantity;
		const changed = await tx.$executeRaw`
			UPDATE "Distribution"
			SET "status" = 'RECEIVED'::"DistributionStatus",
				"receivedAt" = CURRENT_TIMESTAMP,
				"receiptProofData" = ${input.receiptProofData ?? null},
				"receiptProofName" = ${input.receiptProofName ?? null},
				"receiptProofMimeType" = ${input.receiptProofMimeType ?? null},
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE "id" = ${distribution.id} AND "status" = 'SHIPPED'::"DistributionStatus"
		`;
		if (changed !== 1) throw new Error("INVALID_DISTRIBUTION_STATUS");
		await tx.logisticsRequest.updateMany({ where: { id: distribution.requestId, status: "SHIPPED" }, data: { status: "RECEIVED" } });
		const targetDefinition = {
			unit: distribution.unit,
			baseUnit: distribution.baseUnit ?? distribution.unit,
			unitDimension: distribution.unitDimension ?? "COUNT" as UnitDimension,
			conversionFactor: distribution.conversionFactor ?? 1,
			conversionStatus: distribution.conversionStatus ?? "NEEDS_REVIEW" as ConversionStatus,
		};
		const targetQuantity = convertBaseToStock(baseQuantity, targetDefinition);
		let target = await tx.logisticsItem.findFirst({
			where: {
				campId: distribution.destinationCampId,
				itemName: distribution.itemName,
				unit: distribution.unit,
				baseUnit: targetDefinition.baseUnit,
				unitDimension: targetDefinition.unitDimension,
				conversionFactor: targetDefinition.conversionFactor,
				conversionStatus: targetDefinition.conversionStatus,
				status: { not: "SPOILED_OR_DAMAGED" },
				damagedQuantity: 0,
			},
		});
		if (!target) {
			target = await tx.logisticsItem.create({
			data: {
				campId: distribution.destinationCampId,
				itemName: distribution.itemName,
				quantity: 0,
				reservedQuantity: 0,
				damagedQuantity: 0,
				minimumQuantity: 0,
				unit: distribution.unit,
				baseUnit: targetDefinition.baseUnit,
				unitDimension: targetDefinition.unitDimension,
				conversionFactor: targetDefinition.conversionFactor,
				conversionStatus: targetDefinition.conversionStatus,
				quantityBase: 0,
				reservedQuantityBase: 0,
				damagedQuantityBase: 0,
				minimumQuantityBase: 0,
				status: "SUFFICIENT",
				notes: distribution.notes,
			},
			});
		}
		await tx.logisticsItem.update({ where: { id: target.id }, data: { quantity: { increment: targetQuantity }, quantityBase: { increment: baseQuantity } } });
		await refreshOperationalStatus(tx, target.id);
		await recordMovement(tx, { logisticsItemId: target.id, campId: distribution.destinationCampId, type: movementType("DISTRIBUTION_IN"), quantity: targetQuantity, baseQuantity, unitFields: targetDefinition, createdById: input.createdById, distributionId: distribution.id, reason: input.reason ?? "Distribusi diterima" });
		return tx.distribution.findUniqueOrThrow({ where: { id: distribution.id } });
	});
}
