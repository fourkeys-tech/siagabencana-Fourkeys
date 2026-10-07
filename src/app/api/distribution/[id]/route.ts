import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { canManageRequest, canReceiveDistribution, canReviewRequest, isPositiveInteger } from "@/lib/distribution";
import { approveAndReserveDistribution, receiveDistribution, releaseReservation, shipStock } from "@/lib/inventory";

type Params = { params: Promise<{ id: string }> };

const RECEIPT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidImageSignature(bytes: ArrayBuffer, mimeType: string) {
	const view = new Uint8Array(bytes);
	if (mimeType === "image/jpeg") return view.length >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff;
	if (mimeType === "image/png") return view.length >= 8 && view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47 && view[4] === 0x0d && view[5] === 0x0a && view[6] === 0x1a && view[7] === 0x0a;
	return view.length >= 12 && view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 && view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50;
}

async function getRequest(id: string) {
	return prisma.logisticsRequest.findUnique({ where: { id }, select: {
		id: true, sourceCampId: true, destinationCampId: true, createdById: true, reviewedById: true,
		itemName: true, quantity: true, unit: true, notes: true, requestedQuantity: true, requestedUnit: true,
		baseQuantity: true, baseUnit: true, unitDimension: true, conversionFactor: true, conversionStatus: true,
		rejectionReason: true, status: true, createdAt: true, updatedAt: true,
		sourceCamp: { select: { id: true, name: true } }, destinationCamp: { select: { id: true, name: true } },
		createdBy: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } },
		distribution: { select: { id: true, status: true, shippedAt: true, receivedAt: true } },
	} });
}

async function getDistribution(id: string) {
	return prisma.distribution.findUnique({ where: { id }, select: {
		id: true, requestId: true, sourceCampId: true, destinationCampId: true, sourceItemId: true, createdById: true,
		itemName: true, quantity: true, unit: true, notes: true, status: true, shippedAt: true, receivedAt: true,
		createdAt: true, updatedAt: true, sourceCamp: { select: { id: true, name: true } }, destinationCamp: { select: { id: true, name: true } },
		requestedQuantity: true, requestedUnit: true, baseQuantity: true, baseUnit: true, unitDimension: true, conversionFactor: true, conversionStatus: true,
		sourceItem: { select: {
			id: true, itemName: true, quantity: true, reservedQuantity: true, unit: true, baseUnit: true, unitDimension: true,
			conversionFactor: true, conversionStatus: true, quantityBase: true, reservedQuantityBase: true, damagedQuantity: true, damagedQuantityBase: true,
		} },
		createdBy: { select: { id: true, name: true } }, request: { select: { id: true, status: true } },
	} });
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
		SOURCE_STOCK_MISMATCH: { status: 400, message: "Barang sumber tidak cocok dengan permintaan atau sedang rusak." },
		INSUFFICIENT_AVAILABLE_STOCK: { status: 409, message: "Stok tersedia tidak mencukupi." },
		RESERVATION_NOT_FOUND: { status: 409, message: "Reservasi stok tidak ditemukan." },
		QUANTITY_EXCEEDS_REQUEST: { status: 400, message: "Jumlah distribusi melebihi permintaan." },
		CONVERSION_REQUIRED: { status: 400, message: "Isi kemasan belum didefinisikan. Lengkapi faktor konversi terlebih dahulu." },
		CONVERSION_NOT_EXACT: { status: 400, message: "Jumlah tidak dapat dikonversi tepat ke unit stok." },
		CONVERSION_OVERFLOW: { status: 400, message: "Hasil konversi terlalu besar." },
		CONVERSION_DEFINITION_REQUIRED: { status: 400, message: "Definisi konversi wajib diisi untuk unit berbeda." },
		INVALID_CONVERSION_FACTOR: { status: 400, message: "Faktor konversi stok tidak valid." },
		UNIT_CONVERSION_NOT_SUPPORTED: { status: 400, message: "Unit permintaan tidak memiliki definisi konversi yang aman." },
		BASE_UNIT_DIMENSION_MISMATCH: { status: 400, message: "Unit dasar stok tidak sesuai dengan dimensi barang." },
		UNIT_REQUIRED: { status: 400, message: "Definisi unit stok tidak lengkap." },
		UNIT_NOT_SUPPORTED: { status: 400, message: "Unit tidak tersedia di katalog unit." },
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
		const canOperateDistribution = user.role === "SUPER_ADMIN" || (Boolean(user.campId) && (user.role === "MANAGER" || canManageDivision(user, "LOGISTICS", user.campId!)));
		if (!canOperateDistribution) return NextResponse.json({ success: false, message: "Fitur distribusi hanya tersedia untuk Manager atau tim logistik posko." }, { status: 403 });
		const { id } = await params;
		const isMultipart = (request.headers.get("content-type") ?? "").includes("multipart/form-data");
		let body: Record<string, unknown>;
		let receiptProofData: string | undefined;
		let receiptProofName: string | undefined;
		let receiptProofMimeType: string | undefined;
		if (isMultipart) {
			const form = await request.formData();
			const formAction = form.get("action");
			const formReason = form.get("reason");
			body = { action: typeof formAction === "string" ? formAction : "", reason: typeof formReason === "string" ? formReason : "" };
			if (String(body.action).toUpperCase() === "RECEIVE") {
				const proof = form.get("proof");
				if (!(proof instanceof File)) return NextResponse.json({ success: false, message: "Bukti penerimaan berupa gambar wajib dilampirkan." }, { status: 400 });
				if (!RECEIPT_PROOF_TYPES.has(proof.type) || proof.size <= 0 || proof.size > RECEIPT_PROOF_MAX_BYTES) return NextResponse.json({ success: false, message: "Bukti harus berupa JPG, PNG, atau WebP maksimal 5 MB." }, { status: 400 });
				const bytes = await proof.arrayBuffer();
				if (!hasValidImageSignature(bytes, proof.type)) return NextResponse.json({ success: false, message: "Isi file bukti bukan gambar yang valid." }, { status: 400 });
				receiptProofData = `data:${proof.type};base64,${Buffer.from(bytes).toString("base64")}`;
				receiptProofName = proof.name.slice(0, 255);
				receiptProofMimeType = proof.type;
			}
		} else body = await request.json() as Record<string, unknown>;

		const action = String(body.action ?? "").toUpperCase();
		if (action === "RECEIVE" && !receiptProofData) return NextResponse.json({ success: false, message: "Bukti penerimaan berupa gambar wajib dilampirkan." }, { status: 400 });
		if ((action === "APPROVE" || action === "REJECT") && user.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, message: "Hanya Super Admin yang dapat menyetujui atau menolak permintaan distribusi." }, { status: 403 });
		const distribution = await getDistribution(id);
		if (distribution) {
			if (action === "CANCEL") {
				if (user.role !== "SUPER_ADMIN" && !canReviewRequest(user, distribution.sourceCampId)) return NextResponse.json({ success: false, message: "Hanya Super Admin atau logistik posko asal yang dapat membatalkan reservasi." }, { status: 403 });
				const result = await releaseReservation({ distributionId: id, createdById: user.id, reason: typeof body.reason === "string" ? body.reason : undefined });
				return NextResponse.json({ success: true, message: "Distribusi dibatalkan dan reservasi dilepas.", data: result });
			}
			if (action === "SHIP") {
				if (user.role !== "SUPER_ADMIN" && !canReviewRequest(user, distribution.sourceCampId)) return NextResponse.json({ success: false, message: "Hanya Super Admin atau logistik posko asal yang dapat mengirim distribusi." }, { status: 403 });
				const result = await shipStock({ distributionId: id, createdById: user.id, reason: typeof body.reason === "string" ? body.reason : undefined });
				return NextResponse.json({ success: true, message: "Distribusi dikirim dan stok asal berkurang.", data: result });
			}
			if (action === "RECEIVE") {
				if (!canReceiveDistribution(user, distribution.destinationCampId)) return NextResponse.json({ success: false, message: "Hanya Manager atau petugas logistik posko tujuan yang dapat menerima distribusi." }, { status: 403 });
				const result = await receiveDistribution({ distributionId: id, createdById: user.id, reason: String(body.reason ?? "").trim(), receiptProofData, receiptProofName, receiptProofMimeType });
				return NextResponse.json({ success: true, message: "Distribusi diterima dan stok tujuan bertambah.", data: result });
			}
			return NextResponse.json({ success: false, message: "Aksi distribusi tidak valid." }, { status: 400 });
		}

		const logisticsRequest = await getRequest(id);
		if (!logisticsRequest) return NextResponse.json({ success: false, message: "Permintaan distribusi tidak ditemukan." }, { status: 404 });
		if (user.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, message: "Hanya Super Admin yang dapat mereview permintaan." }, { status: 403 });
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
		const result = await approveAndReserveDistribution({
			requestId: id,
			sourceItemId,
			quantity,
			createdById: user.id,
		});
		return NextResponse.json({ success: true, message: "Permintaan disetujui dan stok berhasil direservasi.", data: result });
	} catch (error) {
		const known = inventoryError(error);
		if (known) return NextResponse.json({ success: false, message: known.message }, { status: known.status });
		if (isAuthError(error)) return authError(error);
		console.error("UPDATE_DISTRIBUTION_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal memperbarui distribusi." }, { status: 500 });
	}
}
