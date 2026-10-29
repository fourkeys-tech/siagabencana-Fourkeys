import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { isSerializationConflict, SERIALIZATION_CONFLICT_MESSAGE } from "@/lib/prisma-errors";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, parseBoolean, validateOptionalText, validateText } from "@/lib/validation";

type Params = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const evacuee = await prisma.evacueeRecord.findUnique({
            where: { id },
            include: {
                camp: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                    },
                },
            },
        });

        if (!evacuee) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Data pengungsi tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "DATA_REGISTRATION", evacuee.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        return NextResponse.json({
            success: true,
            data: evacuee,
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_EVACUEE_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil data." },
            { status: 500 },
        );
    }
}

export async function PUT(
    request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const existing = await prisma.evacueeRecord.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Data pengungsi tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "DATA_REGISTRATION", existing.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        const body = await readJson(request);

        if (body.name !== undefined) {
            const nameError = validateText(body.name, "Nama pengungsi", MAX_NAME_LENGTH);
            if (nameError) return NextResponse.json({ success: false, message: nameError }, { status: 400 });
        }

        const notesError = validateOptionalText(body.notes, "Catatan", MAX_NOTE_LENGTH);
        if (notesError) return NextResponse.json({ success: false, message: notesError }, { status: 400 });

        // totalFamily memengaruhi okupansi posko; perubahan harus lewat check-out + registrasi ulang.
        if (body.totalFamily !== undefined && Number(body.totalFamily) !== existing.totalFamily) {
            return NextResponse.json({ success: false, message: "Jumlah anggota keluarga tidak dapat diubah langsung. Lakukan check-out lalu registrasi ulang." }, { status: 400 });
        }

        let parsedSpecialNeeds: boolean | undefined;
        if (body.hasSpecialNeeds !== undefined) {
            parsedSpecialNeeds = parseBoolean(body.hasSpecialNeeds);
            if (parsedSpecialNeeds === undefined) {
                return NextResponse.json({ success: false, message: "Pilihan kebutuhan khusus tidak valid." }, { status: 400 });
            }
        }

        const updated = await prisma.evacueeRecord.update({
            where: { id },
            data: {
                ...(body.name !== undefined && {
                    name: String(body.name).trim(),
                }),
                ...(parsedSpecialNeeds !== undefined && {
                    hasSpecialNeeds: parsedSpecialNeeds,
                }),
                ...(body.notes !== undefined && {
                    notes: body.notes
                        ? String(body.notes).trim()
                        : null,
                }),
            },
        });

        await writeAuditLog({ userId: user.id, action: "UPDATE", entity: "EvacueeRecord", entityId: id, details: { campId: existing.campId, hasSpecialNeeds: updated.hasSpecialNeeds } });

        return NextResponse.json({
            success: true,
            message: "Data pengungsi berhasil diperbarui.",
            data: updated,
        });
    } catch (error) {
        if (isInvalidJson(error)) return invalidJsonResponse();
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("UPDATE_EVACUEE_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal memperbarui data." },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const existing = await prisma.evacueeRecord.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Data pengungsi tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "DATA_REGISTRATION", existing.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        let wasActive = false;

        // Atomic: cegah race condition dengan checkout paralel.
        // Hapus hanya yang belum checkout (departedAt: null) terlebih dahulu.
        // Jika cocok 1 baris, posko dikurangi okupansinya.
        // Jika 0, coba hapus yang sudah checkout (tanpa mengurangi okupansi).
        // Jika keduanya 0, record sudah dihapus transaksi lain → 404.
        await prisma.$transaction(async (tx) => {
            const activeDeleted = await tx.evacueeRecord.deleteMany({
                where: { id, departedAt: null },
            });

            if (activeDeleted.count === 1) {
                wasActive = true;
                const camp = await tx.camp.findUnique({
                    where: { id: existing.campId },
                    select: { currentOccupants: true },
                });

                if (!camp || camp.currentOccupants < existing.totalFamily) {
                    throw new Error("INVALID_CAMP_OCCUPANCY");
                }

                await tx.camp.update({
                    where: { id: existing.campId },
                    data: {
                        currentOccupants: {
                            decrement: existing.totalFamily,
                        },
                    },
                });
                return;
            }

            const departedDeleted = await tx.evacueeRecord.deleteMany({
                where: { id },
            });
            if (departedDeleted.count !== 1) throw new Error("EVACUEE_NOT_FOUND");
        });

        await writeAuditLog({ userId: user.id, action: "DELETE", entity: "EvacueeRecord", entityId: id, details: { campId: existing.campId, totalFamily: existing.totalFamily, wasActive } });

        return NextResponse.json({
            success: true,
            message: "Data pengungsi berhasil dihapus.",
        });
    } catch (error) {
        if (isSerializationConflict(error)) return NextResponse.json({ success: false, message: SERIALIZATION_CONFLICT_MESSAGE }, { status: 409 });
        if (error instanceof Error && error.message === "EVACUEE_NOT_FOUND") {
            return NextResponse.json({ success: false, message: "Data pengungsi tidak ditemukan." }, { status: 404 });
        }
        if (error instanceof Error && error.message === "INVALID_CAMP_OCCUPANCY") {
            return NextResponse.json(
                { success: false, message: "Jumlah pengungsi saat ini di posko tidak mencukupi untuk penghapusan ini." },
                { status: 409 },
            );
        }

        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("DELETE_EVACUEE_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal menghapus data." },
            { status: 500 },
        );
    }
}
