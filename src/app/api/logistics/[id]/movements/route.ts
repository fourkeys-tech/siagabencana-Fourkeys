import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageDivision, requireAuth } from "@/lib/auth/guard";
import { damageStock, disposeStock, receiveStock, recordLoss, restoreStock } from "@/lib/inventory";
import { writeAuditLog } from "@/lib/audit";
import { handleRouteError } from "@/lib/api-errors";
import { assertCampActive } from "@/lib/camps";
import { readJson } from "@/lib/http";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { MAX_NOTE_LENGTH, validateOptionalText } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
	try {
		const user = await requireAuth();
		const { id } = await params;
		const item = await prisma.logisticsItem.findUnique({ where: { id }, select: { id: true, campId: true } });
		if (!item) return NextResponse.json({ success: false, message: "Data logistik tidak ditemukan." }, { status: 404 });
		if (!canManageDivision(user, "LOGISTICS", item.campId)) return NextResponse.json({ success: false, message: "Tidak memiliki akses ke item ini." }, { status: 403 });

		const url = new URL(request.url);
		const paginationParams = parsePagination(url, 50, 100);
		const skip = (paginationParams.page! - 1) * paginationParams.limit!;
		const where = { logisticsItemId: id };

		const [movements, total] = await Promise.all([
			prisma.inventoryMovement.findMany({
				where,
				skip,
				take: paginationParams.limit,
				orderBy: { createdAt: "desc" },
				include: { createdBy: { select: { id: true, name: true } } },
			}),
			prisma.inventoryMovement.count({ where }),
		]);
		return paginatedResponse(movements, total, paginationParams);
	} catch (error) {
		return handleRouteError(error, { context: "GET_INVENTORY_MOVEMENTS_ERROR", fallback: "Gagal mengambil riwayat stok." });
	}
}

export async function POST(request: Request, { params }: Params) {
	try {
		const user = await requireAuth();
		const { id } = await params;
		const item = await prisma.logisticsItem.findUnique({ where: { id } });
		if (!item) return NextResponse.json({ success: false, message: "Data logistik tidak ditemukan." }, { status: 404 });
		if (!canManageDivision(user, "LOGISTICS", item.campId)) return NextResponse.json({ success: false, message: "Tidak memiliki akses untuk mengubah stok." }, { status: 403 });

		await assertCampActive(item.campId);

		const body = await readJson(request);

		const reasonError = validateOptionalText(body.reason, "Alasan", MAX_NOTE_LENGTH);
		if (reasonError) return NextResponse.json({ success: false, message: reasonError }, { status: 400 });

		const action = String(body.action ?? "").toUpperCase();
		const input = { logisticsItemId: id, quantity: Number(body.quantity), createdById: user.id, reason: String(body.reason ?? "").trim() };
		let updated;
		if (action === "RECEIPT") updated = await receiveStock(input);
		else if (action === "DAMAGE") updated = await damageStock(input);
		else if (action === "LOSS") updated = await recordLoss(input);
		else if (action === "RESTORE") updated = await restoreStock(input);
		else if (action === "DISPOSE") updated = await disposeStock(input);
		else return NextResponse.json({ success: false, message: "Jenis pergerakan stok tidak valid." }, { status: 400 });

		await writeAuditLog({ userId: user.id, action: `STOCK_${action}`, entity: "LogisticsItem", entityId: id, details: { campId: item.campId, quantity: input.quantity, reason: input.reason || null } });

		const messages: Record<string, string> = {
			RECEIPT: "Stok masuk berhasil dicatat.",
			DAMAGE: "Barang rusak berhasil dicatat.",
			LOSS: "Kehilangan stok berhasil dicatat.",
			RESTORE: "Pemulihan stok berhasil dicatat.",
			DISPOSE: "Barang rusak dikeluarkan dari inventaris.",
		};
		return NextResponse.json({ success: true, message: messages[action] ?? "Pergerakan stok dicatat.", data: updated });
	} catch (error) {
		return handleRouteError(error, {
			context: "CREATE_INVENTORY_MOVEMENT_ERROR",
			fallback: "Gagal mencatat pergerakan stok.",
			messages: { CAMP_NOT_ACTIVE: "Posko sudah ditutup sehingga tidak dapat menerima pergerakan stok." },
		});
	}
}
