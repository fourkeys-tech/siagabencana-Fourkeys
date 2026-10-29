import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { assertCampActive, campError } from "@/lib/camps";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, validateText } from "@/lib/validation";

export async function GET(request: Request) {
    try {
        const user = await requireAuth();
        if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "SHELTER", user.campId))) {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses ke divisi shelter posko ini." }, { status: 403 });
        }

        const url = new URL(request.url);
        const params = parsePagination(url, 50, 100);
        const skip = (params.page! - 1) * params.limit!;
        const q = url.searchParams.get("q")?.trim();
        const status = url.searchParams.get("status")?.trim().toUpperCase();

        const baseWhere = user.role === "SUPER_ADMIN" ? {} : { campId: user.campId! };
        const where: Prisma.FacilityReportWhereInput = {
            ...baseWhere,
            ...(q ? { facilityName: { contains: q, mode: "insensitive" } } : {}),
            ...(status && ["GOOD", "DAMAGED", "REPAIRING"].includes(status) ? { status: status as "GOOD" | "DAMAGED" | "REPAIRING" } : {}),
        };

        const [reports, total] = await Promise.all([
            prisma.facilityReport.findMany({
                where,
                skip,
                take: params.limit,
                orderBy: { updatedAt: "desc" },
                include: {
                    camp: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            prisma.facilityReport.count({ where }),
        ]);

        return paginatedResponse(reports, total, params);
    } catch (error) {
        if (isAuthError(error)) return authError(error);
        console.error("GET_SHELTER_ERROR", error);
        return NextResponse.json({ success: false, message: "Gagal mengambil data shelter." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await requireAuth();

        if (
            user.role !== "SUPER_ADMIN" &&
            (!user.campId || !canManageDivision(user, "SHELTER", user.campId))
        ) {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses shelter." }, { status: 403 });
        }

        const body = await readJson(request);

        const campId =
            user.role === "SUPER_ADMIN"
                ? (typeof body.campId === "string" ? body.campId : "")
                : (user.campId ?? "");

        if (!campId) {
            return NextResponse.json({ success: false, message: "Posko wajib dipilih." }, { status: 400 });
        }

        const nameError = validateText(body.facilityName, "Nama fasilitas", MAX_NAME_LENGTH);
        if (nameError) return NextResponse.json({ success: false, message: nameError }, { status: 400 });

        const descError = validateText(body.description, "Deskripsi fasilitas", MAX_NOTE_LENGTH);
        if (descError) return NextResponse.json({ success: false, message: descError }, { status: 400 });

        await assertCampActive(campId);

        const status = String(body.status ?? "GOOD").toUpperCase();
        // Laporan baru hanya boleh dimulai dari GOOD (fasilitas ada) atau DAMAGED (kerusakan baru ditemukan).
        // REPAIRING harus melewati tindakan Mulai Perbaikan dengan catatan petugas.
        if (!["GOOD", "DAMAGED"].includes(status)) {
            return NextResponse.json(
                { success: false, message: "Status awal fasilitas hanya boleh Baik atau Rusak." },
                { status: 400 },
            );
        }

        const report = await prisma.facilityReport.create({
            data: {
                campId,
                facilityName: String(body.facilityName).trim(),
                status: status as "GOOD" | "DAMAGED",
                description: String(body.description).trim(),
            },
        });

        await writeAuditLog({
            userId: user.id,
            action: "CREATE",
            entity: "FacilityReport",
            entityId: report.id,
            details: { campId, facilityName: report.facilityName, status: report.status },
        });

        return NextResponse.json(
            {
                success: true,
                message: "Laporan shelter berhasil dibuat.",
                data: report,
            },
            { status: 201 },
        );
    } catch (error) {
        if (isInvalidJson(error)) return invalidJsonResponse();
        if (isAuthError(error)) return authError(error);
        const knownCampError = campError(error);
        if (knownCampError) return NextResponse.json({ success: false, message: knownCampError.message }, { status: knownCampError.status });

        console.error("CREATE_SHELTER_ERROR", error);
        return NextResponse.json({ success: false, message: "Gagal membuat laporan shelter." }, { status: 500 });
    }
}
