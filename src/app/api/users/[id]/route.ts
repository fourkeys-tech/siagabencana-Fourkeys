import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authError, canAssignRole, isAuthError, requireAuth, requireRole } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { isForeignKeyError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { deleteOtherSessions, deleteUserSessions } from "@/lib/auth/session";
import { assertCampActive, campError } from "@/lib/camps";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { isValidEmail, MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, validatePassword, validateText } from "@/lib/validation";

type Params = {
    params: Promise<{
        id: string;
    }>;
};

type EditableRole = "MANAGER" | "DIVISION_HEAD" | "FIELD_OFFICER" | "SUPER_ADMIN";
type EditableDivision = "LOGISTICS" | "SHELTER" | "DATA_REGISTRATION";

export async function GET(
    _request: Request,
    { params }: Params,
) {
    try {
        const currentUser = await requireAuth();
        const { id } = await params;

        if (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "MANAGER") {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses ke anggota." }, { status: 403 });
        }

        const user = await prisma.user.findUnique({
            where: {
                id,
                ...(currentUser.role === "MANAGER"
                    ? { campId: currentUser.campId ?? "", role: { in: ["DIVISION_HEAD", "FIELD_OFFICER"] } }
                    : {}),
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                division: true,
                campId: true,
                camp: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
            data: user,
        });
    } catch (error) {
		if (isAuthError(error)) {
			return authError(error, "Tidak memiliki akses ke anggota.");
		}

		console.error("GET_USER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil user." },
            { status: 500 },
        );
    }
}

export async function PUT(
    request: Request,
    { params }: Params,
) {
    try {
        const currentUser = await requireAuth();
        const { id } = await params;
        const managerEditing = currentUser.role === "MANAGER";
        if (!managerEditing && currentUser.role !== "SUPER_ADMIN") {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses untuk mengedit anggota." }, { status: 403 });
        }
        const body = await readJson(request);

        const existingUser = await prisma.user.findUnique({
            where: { id },
        });

        if (!existingUser) {
            return NextResponse.json({ success: false, message: "User tidak ditemukan." }, { status: 404 });
        }
        if (managerEditing && (existingUser.campId !== currentUser.campId || !["DIVISION_HEAD", "FIELD_OFFICER"].includes(existingUser.role))) {
            return NextResponse.json({ success: false, message: "Manager hanya dapat mengedit ketua atau petugas di poskonya sendiri." }, { status: 403 });
        }

        // Jangan sampai Super Admin menghapus role dirinya sendiri
        // melalui update menjadi role lain.
        if (
            id === currentUser.id &&
            body.role &&
            body.role !== "SUPER_ADMIN"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Role Super Admin sendiri tidak dapat diubah.",
                },
                { status: 400 },
            );
        }

        const role = (body.role === undefined ? existingUser.role : String(body.role)) as EditableRole;

        if (
            !["MANAGER", "DIVISION_HEAD", "FIELD_OFFICER", "SUPER_ADMIN"].includes(role)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Role tidak valid.",
                },
                { status: 400 },
            );
        }

        const division = (body.division !== undefined
            ? typeof body.division === "string" ? body.division : null
            : existingUser.division) as EditableDivision | null;

        const campId = body.campId !== undefined
            ? typeof body.campId === "string" ? body.campId : null
            : existingUser.campId;

        if (role !== "SUPER_ADMIN" && !campId) {
            return NextResponse.json({ success: false, message: "Manager, ketua divisi, dan Field Officer wajib ditugaskan ke posko." }, { status: 400 });
        }
        if (!canAssignRole(currentUser, role)) {
            return NextResponse.json({ success: false, message: "Manager hanya dapat menetapkan role ketua divisi atau Field Officer." }, { status: 403 });
        }
        if (managerEditing && campId !== currentUser.campId) {
            return NextResponse.json({ success: false, message: "Manager tidak dapat memindahkan anggota ke posko lain." }, { status: 403 });
        }
        if (["DIVISION_HEAD", "FIELD_OFFICER"].includes(role) && !division) {
            return NextResponse.json({ success: false, message: "Ketua divisi dan Field Officer wajib memiliki divisi." }, { status: 400 });
        }

        if (
            division &&
            !["LOGISTICS", "SHELTER", "DATA_REGISTRATION"].includes(division)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Division tidak valid.",
                },
                { status: 400 },
            );
        }

        if (campId) {
            await assertCampActive(campId);
        }

        const data: {
            name?: string;
            email?: string;
            password?: string;
            role?: typeof role;
            division?: typeof division;
            campId?: typeof campId;
        } = {};

        if (body.name !== undefined) {
            const nameError = validateText(body.name, "Nama", MAX_NAME_LENGTH);
            if (nameError) return NextResponse.json({ success: false, message: nameError }, { status: 400 });
            data.name = String(body.name).trim();
        }

        if (body.email !== undefined) {
            const normalizedEmail = String(body.email)
                .trim()
                .toLowerCase();

            if (!normalizedEmail || normalizedEmail.length > MAX_EMAIL_LENGTH || !isValidEmail(normalizedEmail)) {
                return NextResponse.json({ success: false, message: "Format email tidak valid." }, { status: 400 });
            }

            const emailOwner = await prisma.user.findFirst({
                where: {
                    email: normalizedEmail,
                    NOT: { id },
                },
            });

            if (emailOwner) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Email sudah digunakan.",
                    },
                    { status: 409 },
                );
            }

            data.email = normalizedEmail;
        }

        if (body.password) {
            const passwordError = validatePassword(body.password);
            if (passwordError) {
                return NextResponse.json({ success: false, message: passwordError }, { status: 400 });
            }
            data.password = await bcrypt.hash(
                String(body.password),
                12,
            );
        }

        if (role === "MANAGER" && division) {
            return NextResponse.json({ success: false, message: "Manager bertanggung jawab atas seluruh divisi; division harus kosong." }, { status: 400 });
        }

        if (managerEditing && role === "DIVISION_HEAD" && campId && division) {
            const currentHead = await prisma.campDivisionHead.findUnique({ where: { campId_division: { campId, division } } });
            if (currentHead && currentHead.userId !== id) return NextResponse.json({ success: false, message: "Divisi tersebut sudah memiliki ketua." }, { status: 409 });
        }

        const user = await prisma.$transaction(async (tx) => {
            if (role === "MANAGER" && campId) {
                const campManager = await tx.camp.findUnique({ where: { id: campId }, select: { managerId: true } });
                if (campManager?.managerId && campManager.managerId !== id) throw new Error("CAMP_MANAGER_EXISTS");
            }
            if (role === "DIVISION_HEAD" && campId && division) {
                const currentHead = await tx.campDivisionHead.findUnique({ where: { campId_division: { campId, division } } });
                if (currentHead && currentHead.userId !== id) throw new Error("DIVISION_HEAD_EXISTS");
            }

            await tx.camp.updateMany({ where: { managerId: id }, data: { managerId: null } });
            await tx.campDivisionHead.deleteMany({ where: { userId: id } });

            const updated = await tx.user.update({
                where: { id },
                data: {
                    ...data,
                    role,
                    division: role === "SUPER_ADMIN" || role === "MANAGER" ? null : division,
                    campId: role === "SUPER_ADMIN" ? null : campId,
                },
                select: { id: true, name: true, email: true, role: true, division: true, campId: true },
            });

            if (role === "MANAGER" && campId) {
                await tx.camp.update({ where: { id: campId }, data: { managerId: id } });
            }
            if (role === "DIVISION_HEAD" && campId && division) {
                await tx.campDivisionHead.create({ data: { campId, division, userId: id } });
            }
            return updated;
        });

        // Password direset oleh admin/manager: paksa user login ulang di semua perangkat.
        if (data.password) await (id === currentUser.id ? deleteOtherSessions(id) : deleteUserSessions(id));

        await writeAuditLog({ userId: currentUser.id, action: "UPDATE", entity: "User", entityId: id, details: { name: user.name, role: user.role, passwordReset: Boolean(data.password) } });

        return NextResponse.json({
            success: true,
            message: "User berhasil diperbarui.",
            data: user,
        });
    } catch (error) {
        if (isInvalidJson(error)) return invalidJsonResponse();
        if (isUniqueConstraintError(error)) {
            return NextResponse.json({ success: false, message: "Email sudah digunakan." }, { status: 409 });
        }
        const knownCampError = campError(error);
        if (knownCampError) return NextResponse.json({ success: false, message: knownCampError.message }, { status: knownCampError.status });
        if (error instanceof Error && error.message === "CAMP_MANAGER_EXISTS") return NextResponse.json({ success: false, message: "Posko tersebut sudah memiliki manager." }, { status: 409 });
        if (error instanceof Error && error.message === "DIVISION_HEAD_EXISTS") return NextResponse.json({ success: false, message: "Divisi tersebut sudah memiliki ketua di posko ini." }, { status: 409 });
        if (isAuthError(error)) {
            return authError(error, "Tidak memiliki akses untuk mengedit anggota.");
        }

        console.error("UPDATE_USER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal memperbarui user." },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _request: Request,
    { params }: Params,
) {
    try {
        const currentUser = await requireRole("SUPER_ADMIN");

        const { id } = await params;

        if (id === currentUser.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Super Admin tidak dapat menghapus dirinya sendiri.",
                },
                { status: 400 },
            );
        }

        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        // Relasi createdBy bersifat Restrict: user dengan riwayat transaksi tidak boleh dihapus.
        const [requestCount, distributionCount] = await Promise.all([
            prisma.logisticsRequest.count({ where: { createdById: id } }),
            prisma.distribution.count({ where: { createdById: id } }),
        ]);
        if (requestCount > 0 || distributionCount > 0) {
            return NextResponse.json(
                { success: false, message: "User memiliki riwayat transaksi distribusi sehingga tidak dapat dihapus. Ubah role atau posko user tersebut." },
                { status: 409 },
            );
        }

        await prisma.user.delete({
            where: { id },
        });

        await writeAuditLog({ userId: currentUser.id, action: "DELETE", entity: "User", entityId: id, details: { name: user.name, email: user.email } });

        return NextResponse.json({
            success: true,
            message: "User berhasil dihapus.",
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error, "Hanya Super Admin.");
        }
        if (isForeignKeyError(error)) {
            return NextResponse.json(
                { success: false, message: "User masih terhubung dengan data lain sehingga tidak dapat dihapus." },
                { status: 409 },
            );
        }

        console.error("DELETE_USER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal menghapus user." },
            { status: 500 },
        );
    }
}