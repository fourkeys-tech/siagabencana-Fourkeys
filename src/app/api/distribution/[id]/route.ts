import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { canManageRequest, canReceiveDistribution, canReviewRequest, isPositiveInteger } from "@/lib/distribution";
import { approveAndReserveDistribution, receiveDistribution, releaseReservation, shipStock } from "@/lib/inventory";

type Params = { params: Promise<{ id: string }> };

async function getRequest(id: string) {
	return prisma.logisticsRequest.findUnique({ where: { id }, include: { sourceCamp: { select: { id: true, name: true } }, destinationCamp: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } }, distribution: true } });
}

async function getDistribution(id: string) {
	return prisma.distribution.findUnique({ where: { id }, include: { sourceCamp: { select: { id: true, name: true } }, destinationCamp: { select: { id: true, name: true } }, sourceItem: { select: { id: true, itemName: true, quantity: true, reservedQuantity: true, unit: true } }, createdBy: { select: { id: true, name: true } }, request: { select: { id: true, status: true } } } });
}

function inventoryError(error: unknown) {
	if (!(error instanceof Error)) return null;
	const errors: Record<string, { status: number; message: string }> = {
		INVALID_QUANTITY: { status: 400, message: "Jumlah distribusi tidak valid." },
		DISTRIBUTION_NOT_FOUND: { status: 404, message: "Distribusi tidak ditemukan." },
		DISTRIBUTION_REQUEST_NOT_FOUND: { status: 404, message: "Permintaan distribusi tidak ditemukan." },
		INVALID_DISTRIBUTION_STATUS: { status: 409, message: "Status distribusi sudah berubah atau aksi tidak sesuai alur." },
		INVALID_REQUEST_STATUS: { status: 409, message: "Permintaan sudah diproses." },
		SOURCE_STOCK_NOT_FOUND: { status: 409, message: "Stok sumber tidak tersedia." },
		SOURCE_STOCK_MISMATCH: { status: 400, message: "Barang sumber tidak cocok dengan permintaan." },
		INSUFFICIENT_AVAILABLE_STOCK: { status: 409, message: "Stok tersedia tidak mencukupi." },
		RESERVATION_NOT_FOUND: { status: 409, message: "Reservasi stok tidak ditemukan." },
		QUANTITY_EXCEEDS_REQUEST: { status: 400, message: "Jumlah distribusi melebihi permintaan." },
	};
	return errors[error.message] ?? null;
}

export async function GET(_request: Request, { params }: Params) {
	try {
		const user = await requireAuth();
		const { id } = await params;
		const distribution = await getDistribution(id);
		if (distribution) {
			if (!canManageRequest(user, distribution.sourceCampId, distribution.destinationCampId)) return NextResponse.json({ success: false, message: "Tidak memiliki akses ke distribusi ini." }, { status: 403 });
			return NextResponse.json({ success: true, data: distribution });
		}
		const logisticsRequest = await getRequest(id);
		if (!logisticsRequest) return NextResponse.json({ success: false, message: "Data distribusi tidak ditemukan." }, { status: 404 });
		if (!canManageRequest(user, logisticsRequest.sourceCampId, logisticsRequest.destinationCampId)) return NextResponse.json({ success: false, message: "Tidak memiliki akses ke permintaan ini." }, { status: 403 });
		return NextResponse.json({ success: true, data: logisticsRequest });
	} catch (error) {
		if (isAuthError(error)) return authError(error);
		console.error("GET_DISTRIBUTION_DETAIL_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengambil data distribusi." }, { status: 500 });
	}
}

export async function PUT(request: Request, { params }: Params) {
	try {
		const user = await requireAuth();
		if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "LOGISTICS", user.campId))) return NextResponse.json({ success: false, message: "Fitur distribusi hanya tersedia untuk tim logistik posko." }, { status: 403 });
		const { id } = await params;
		const body = await request.json();
		const action = String(body.action ?? "").toUpperCase();
		const distribution = await getDistribution(id);

		if (distribution) {
			if (action === "CANCEL") {
				if (!canReviewRequest(user, distribution.sourceCampId)) return NextResponse.json({ success: false, message: "Hanya logistik posko asal yang dapat membatalkan reservasi." }, { status: 403 });
				const result = await releaseReservation({ distributionId: id, createdById: user.id, reason: body.reason });
				return NextResponse.json({ success: true, message: "Distribusi dibatalkan dan reservasi dilepas.", data: result });
			}
			if (action === "SHIP") {
				if (!canReviewRequest(user, distribution.sourceCampId)) return NextResponse.json({ success: false, message: "Hanya petugas logistik posko asal yang dapat mengirim distribusi." }, { status: 403 });
				const result = await shipStock({ distributionId: id, createdById: user.id, reason: body.reason });
				return NextResponse.json({ success: true, message: "Distribusi dikirim dan stok asal berkurang.", data: result });
			}
			if (action === "RECEIVE") {
				if (!canReceiveDistribution(user, distribution.destinationCampId)) return NextResponse.json({ success: false, message: "Hanya petugas logistik posko tujuan yang dapat menerima distribusi." }, { status: 403 });
				const result = await receiveDistribution({ distributionId: id, createdById: user.id, reason: body.reason });
				return NextResponse.json({ success: true, message: "Distribusi diterima dan stok tujuan bertambah.", data: result });
			}
			return NextResponse.json({ success: false, message: "Aksi distribusi tidak valid." }, { status: 400 });
		}

		const logisticsRequest = await getRequest(id);
		if (!logisticsRequest) return NextResponse.json({ success: false, message: "Permintaan distribusi tidak ditemukan." }, { status: 404 });
		if (!canReviewRequest(user, logisticsRequest.sourceCampId)) return NextResponse.json({ success: false, message: "Hanya logistik posko asal yang dapat mereview permintaan." }, { status: 403 });
		if (logisticsRequest.status !== "PENDING") return NextResponse.json({ success: false, message: "Permintaan sudah diproses." }, { status: 409 });

		if (action === "REJECT") {
			const rejectionReason = String(body.rejectionReason ?? "").trim();
			if (!rejectionReason) return NextResponse.json({ success: false, message: "Alasan penolakan wajib diisi." }, { status: 400 });
			const changed = await prisma.logisticsRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED", reviewedById: user.id, rejectionReason } });
			if (changed.count !== 1) return NextResponse.json({ success: false, message: "Permintaan sudah diproses." }, { status: 409 });
			return NextResponse.json({ success: true, message: "Permintaan distribusi ditolak." });
		}

		if (action !== "APPROVE") return NextResponse.json({ success: false, message: "Aksi review tidak valid." }, { status: 400 });
		const sourceItemId = String(body.sourceItemId ?? "").trim();
		const quantity = Number(body.quantity ?? logisticsRequest.quantity);
		if (!sourceItemId || !isPositiveInteger(quantity)) return NextResponse.json({ success: false, message: "Stok sumber dan jumlah distribusi wajib dipilih." }, { status: 400 });
		const result = await approveAndReserveDistribution({ requestId: id, sourceItemId, quantity, createdById: user.id });
		return NextResponse.json({ success: true, message: "Permintaan disetujui dan stok berhasil direservasi.", data: result });
	} catch (error) {
		const known = inventoryError(error);
		if (known) return NextResponse.json({ success: false, message: known.message }, { status: known.status });
		if (isAuthError(error)) return authError(error);
		console.error("UPDATE_DISTRIBUTION_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal memperbarui distribusi." }, { status: 500 });
	}
}
