import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageDivision, requireAuth } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { handleRouteError } from "@/lib/api-errors";
import { fail, ok } from "@/lib/api-response";
import { assertCampActive } from "@/lib/camps";
import { readJson } from "@/lib/http";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { parseFacilityCategory, parseFacilityQuantity } from "@/lib/shelter-standards";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, validateText } from "@/lib/validation";

const FACILITY_STATUSES = ["GOOD", "DAMAGED", "REPAIRING"] as const;

export async function GET(request: Request) {
    try {
        const user = await requireAuth();
        if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "SHELTER", user.campId))) {
            return fail("Tidak memiliki akses ke divisi shelter posko ini.", 403);
        }

        const url = new URL(request.url);
        const params = parsePagination(url, 50, 100);
        const skip = (params.page! - 1) * params.limit!;
        const q = url.searchParams.get("q")?.trim();
        const status = url.searchParams.get("status")?.trim().toUpperCase();
        const category = parseFacilityCategory(url.searchParams.get("category"));

        const where: Prisma.FacilityReportWhereInput = {
            ...(user.role === "SUPER_ADMIN" ? {} : { campId: user.campId! }),
            ...(q ? { facilityName: { contains: q, mode: "insensitive" } } : {}),
            ...(status && (FACILITY_STATUSES as readonly string[]).includes(status) ? { status: status as (typeof FACILITY_STATUSES)[number] } : {}),
            ...(category ? { category } : {}),
        };

        const [reports, total] = await Promise.all([
            prisma.facilityReport.findMany({
                where,
                skip,
                take: params.limit,
                orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
                include: { camp: { select: { id: true, name: true } } },
            }),
            prisma.facilityReport.count({ where }),
        ]);

        return paginatedResponse(reports, total, params);
    } catch (error) {
        return handleRouteError(error, { context: "GET_SHELTER_ERROR", fallback: "Gagal mengambil data shelter." });
    }
}

export async function POST(request: Request) {
    try {
        const user = await requireAuth();
        if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "SHELTER", user.campId))) {
            return fail("Tidak memiliki akses shelter.", 403);
        }

        const body = await readJson(request);
        const campId = user.role === "SUPER_ADMIN" ? (typeof body.campId === "string" ? body.campId : "") : (user.campId ?? "");
        if (!campId) return fail("Posko wajib dipilih.", 400);

        const category = parseFacilityCategory(body.category);
        if (!category) return fail("Kategori fasilitas wajib dipilih.", 400);

        const quantity = body.quantity === undefined || body.quantity === "" ? 1 : parseFacilityQuantity(body.quantity);
        if (quantity === null) return fail("Jumlah fasilitas harus bilangan bulat lebih dari 0.", 400);

        const nameError = validateText(body.facilityName, "Nama fasilitas", MAX_NAME_LENGTH);
        if (nameError) return fail(nameError, 400);

        const descError = validateText(body.description, "Deskripsi fasilitas", MAX_NOTE_LENGTH);
        if (descError) return fail(descError, 400);

        // Laporan baru hanya boleh dimulai dari GOOD (fasilitas ada) atau DAMAGED (kerusakan baru ditemukan).
        // REPAIRING harus melewati tindakan Mulai Perbaikan dengan catatan petugas.
        const status = String(body.status ?? "GOOD").toUpperCase();
        if (status !== "GOOD" && status !== "DAMAGED") return fail("Status awal fasilitas hanya boleh Baik atau Rusak.", 400);

        await assertCampActive(campId);

        const report = await prisma.facilityReport.create({
            data: {
                campId,
                category,
                quantity,
                facilityName: String(body.facilityName).trim(),
                status,
                description: String(body.description).trim(),
            },
        });

        await writeAuditLog({
            userId: user.id,
            action: "CREATE",
            entity: "FacilityReport",
            entityId: report.id,
            details: { campId, category, quantity, facilityName: report.facilityName, status: report.status },
        });

        return ok(report, "Laporan shelter berhasil dibuat.", 201);
    } catch (error) {
        return handleRouteError(error, { context: "CREATE_SHELTER_ERROR", fallback: "Gagal membuat laporan shelter." });
    }
}
