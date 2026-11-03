import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { writeAuditLog } from "@/lib/audit";
import { handleRouteError } from "@/lib/api-errors";
import { assertCampActive } from "@/lib/camps";
import { readJson } from "@/lib/http";
import { runSerializable } from "@/lib/transaction";
import { isValidTotalFamily, MAX_NAME_LENGTH, MAX_NOTE_LENGTH, parseBoolean, validateOptionalText, validateText } from "@/lib/validation";

export async function GET(request: Request) {
    try {
        const user = await requireAuth();
        if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "DATA_REGISTRATION", user.campId))) {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses ke divisi registrasi posko ini." }, { status: 403 });
        }

        const url = new URL(request.url);
        const params = parsePagination(url);
        const skip = (params.page! - 1) * params.limit!;
        const q = url.searchParams.get("q")?.trim();
        const status = url.searchParams.get("status")?.trim().toUpperCase();

        const baseWhere = user.role === "SUPER_ADMIN" ? {} : { campId: user.campId! };
        const where: Prisma.EvacueeRecordWhereInput = {
            ...baseWhere,
            ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
            ...(status === "ACTIVE" ? { departedAt: null } : status === "CHECKED_OUT" ? { NOT: { departedAt: null } } : {}),
        };

        const [evacuees, total] = await Promise.all([
            prisma.evacueeRecord.findMany({
                where,
                orderBy: { arrivedAt: "desc" },
                skip,
                take: params.limit,
                include: {
                    camp: { select: { id: true, name: true } },
                },
            }),
            prisma.evacueeRecord.count({ where }),
        ]);

        return paginatedResponse(evacuees, total, params);
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_EVACUEES_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil data pengungsi." },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await requireAuth();

        if (
            user.role !== "SUPER_ADMIN" &&
            (!user.campId || !canManageDivision(user, "DATA_REGISTRATION", user.campId))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tidak memiliki akses registrasi.",
                },
                { status: 403 },
            );
        }

        const body = await readJson(request);

        const campId =
            user.role === "SUPER_ADMIN"
                ? (typeof body.campId === "string" ? body.campId.trim() : "")
                : user.campId;

        const totalFamily = Number(body.totalFamily ?? 1);

        if (!campId || !isValidTotalFamily(totalFamily)) {
            return NextResponse.json(
                { success: false, message: "Posko dan jumlah anggota keluarga yang valid wajib diisi." },
                { status: 400 },
            );
        }

        const inputError = validateText(body.name, "Nama", MAX_NAME_LENGTH) ?? validateOptionalText(body.notes, "Catatan", MAX_NOTE_LENGTH);
        if (inputError) return NextResponse.json({ success: false, message: inputError }, { status: 400 });

        // Boolean("false") === true, jadi string dari form harus di-parse eksplisit.
        const hasSpecialNeeds = body.hasSpecialNeeds === undefined || body.hasSpecialNeeds === null ? false : parseBoolean(body.hasSpecialNeeds);
        if (hasSpecialNeeds === undefined) {
            return NextResponse.json({ success: false, message: "Kebutuhan khusus harus bernilai true atau false." }, { status: 400 });
        }

        const name = String(body.name).trim();
        const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

        // Serializable + retry P2034: registrasi paralel tidak bisa sama-sama lolos cek kapasitas.
        const result = await runSerializable(async (tx) => {
            await assertCampActive(campId, tx);
            const camp = await tx.camp.findUniqueOrThrow({ where: { id: campId }, select: { currentOccupants: true, maxCapacity: true } });
            if (camp.currentOccupants + totalFamily > camp.maxCapacity) throw new Error("CAMP_FULL");

            const evacuee = await tx.evacueeRecord.create({
                data: { campId, name, totalFamily, hasSpecialNeeds, notes },
            });
            await tx.camp.update({
                where: { id: campId },
                data: { currentOccupants: { increment: totalFamily } },
            });
            return evacuee;
        });

        await writeAuditLog({ userId: user.id, action: "CREATE", entity: "EvacueeRecord", entityId: result.id, details: { campId, totalFamily, hasSpecialNeeds: result.hasSpecialNeeds } });

        return NextResponse.json(
            {
                success: true,
                message: "Pengungsi berhasil diregistrasikan.",
                data: result,
            },
            { status: 201 },
        );
    } catch (error) {
        return handleRouteError(error, {
            context: "CREATE_EVACUEE_ERROR",
            fallback: "Gagal registrasi pengungsi.",
            messages: { CAMP_NOT_ACTIVE: "Posko tidak aktif sehingga tidak dapat menerima pengungsi baru." },
        });
    }
}