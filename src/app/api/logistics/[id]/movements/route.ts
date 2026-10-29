import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { damageStock, disposeStock, receiveStock, recordLoss, restoreStock } from "@/lib/inventory";
import { writeAuditLog } from "@/lib/audit";
import { assertCampActive, campError } from "@/lib/camps";
import { isSerializationConflict, SERIALIZATION_CONFLICT_MESSAGE } from "@/lib/prisma-errors";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { MAX_NOTE_LENGTH, validateOptionalText } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
	try {
		const user = await requireAuth();
		const { id } = await params;
		const item = await prisma.logisticsItem.findUnique({ where: { id }, select: { id: true, campId: true } });
		if (!item) return NextResponse.json({ success: false, message: "Data logistik tidak ditemukan." }, { status: 404 });
		if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "LOGISTICS", item.campId)) return NextResponse.json({ success: false, message: "Tidak memiliki akses ke item ini." }, { status: 403 });

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
		if (isAuthError(error)) return authError(error);
		console.error("GET_INVENTORY_MOVEMENTS_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengambil riwayat stok." }, { status: 500 });
	}
}

export async function POST(request: Request, { params }: Params) {
	try {
		const user = await requireAuth();
		const { id } = await params;
		const item = await prisma.logisticsItem.findUnique({ where: { id } });
		if (!item) return NextResponse.json({ success: false, message: "Data logistik tidak ditemukan." }, { status: 404 });
		if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "LOGISTICS", item.campId)) return NextResponse.json({ success: false, message: "Tidak memiliki akses untuk mengubah stok." }, { status: 403 });

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
		if (isInvalidJson(error)) return invalidJsonResponse();
		if (isSerializationConflict(error)) return NextResponse.json({ success: false, message: SERIALIZATION_CONFLICT_MESSAGE }, { status: 409 });
		const knownCampError = campError(error);
		if (knownCampError) return NextResponse.json({ success: false, message: knownCampError.message }, { status: knownCampError.status });

		if (error instanceof Error) {
			const messages: Record<string, { status: number; message: string }> = {
				INVALID_QUANTITY: { status: 400, message: "Jumlah harus bilangan bulat lebih dari 0." },
				MOVEMENT_REASON_REQUIRED: { status: 400, message: "Alasan wajib diisi." },
				INSUFFICIENT_AVAILABLE_STOCK: { status: 409, message: "Stok tersedia tidak mencukupi." },
				LOGISTICS_ITEM_NOT_FOUND: { status: 404, message: "Data logistik tidak ditemukan." },
				RESTORE_QUANTITY_EXCEEDS_DAMAGED: { status: 409, message: "Jumlah pemulihan melebihi jumlah barang rusak yang tercatat." },
				DISPOSE_QUANTITY_EXCEEDS_DAMAGED: { status: 409, message: "Jumlah yang dikeluarkan melebihi jumlah barang rusak yang tercatat." },
				CONVERSION_REQUIRED: { status: 400, message: "Definisi isi kemasan belum lengkap. Lengkapi faktor konversi sebelum mencatat pergerakan." },
				CONVERSION_DEFINITION_REQUIRED: { status: 400, message: "Definisi konversi wajib diisi untuk unit berbeda." },
				CONVERSION_OVERFLOW: { status: 400, message: "Hasil konversi terlalu besar." },
				INVALID_CONVERSION_FACTOR: { status: 400, message: "Faktor konversi stok tidak valid." },
				BASE_UNIT_DIMENSION_MISMATCH: { status: 400, message: "Unit dasar stok tidak sesuai dengan dimensi barang." },
				UNIT_REQUIRED: { status: 400, message: "Definisi unit stok tidak lengkap." },
				UNIT_NOT_SUPPORTED: { status: 400, message: "Unit tidak tersedia di katalog unit." },
				CAMP_NOT_ACTIVE: { status: 409, message: "Posko sudah ditutup sehingga tidak dapat menerima pergerakan stok." },
				P2034_EXHAUSTED: { status: 409, message: SERIALIZATION_CONFLICT_MESSAGE },
			};
			const known = messages[error.message];
			if (known) return NextResponse.json({ success: false, message: known.message }, { status: known.status });
		}
		if (isAuthError(error)) return authError(error);
		console.error("CREATE_INVENTORY_MOVEMENT_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mencatat pergerakan stok." }, { status: 500 });
	}
}
