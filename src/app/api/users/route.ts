import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth, requireRole } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
    try {
        const currentUser = await requireAuth();
        if (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "MANAGER") {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses ke daftar anggota." }, { status: 403 });
        }

        const users = await prisma.user.findMany({
            where: currentUser.role === "MANAGER"
                ? { campId: currentUser.campId ?? "", role: { in: ["DIVISION_HEAD", "FIELD_OFFICER"] } }
                : undefined,
            orderBy: {
                createdAt: "desc",
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

        return NextResponse.json({
            success: true,
            data: users,
        });
	} catch (error) {
		if (isAuthError(error)) {
			return authError(error, "Tidak memiliki akses ke daftar anggota.");
		}

		console.error("GET_USERS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil data user." },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const currentUser = await requireRole("SUPER_ADMIN");

        const body = await request.json();

        const {
            name,
            email,
            password,
            role,
            division,
            campId,
        } = body;

        if (!name || !email || !password || !role) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Name, email, password, dan role wajib diisi.",
                },
                { status: 400 },
            );
        }

        if (!["MANAGER", "DIVISION_HEAD", "FIELD_OFFICER", "SUPER_ADMIN"].includes(role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Role tidak valid.",
                },
                { status: 400 },
            );
        }

        if (role !== "SUPER_ADMIN" && !campId) {
            return NextResponse.json(
                { success: false, message: "Manager, ketua divisi, dan Field Officer wajib ditugaskan ke posko." },
                { status: 400 },
            );
        }
        if (["DIVISION_HEAD", "FIELD_OFFICER"].includes(role) && !division) {
            return NextResponse.json(
                { success: false, message: "Ketua divisi dan Field Officer wajib memiliki divisi." },
                { status: 400 },
            );
        }
        if (role === "MANAGER" && division) {
            return NextResponse.json(
                { success: false, message: "Manager bertanggung jawab atas seluruh divisi; kosongkan pilihan divisi." },
                { status: 400 },
            );
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
            const camp = await prisma.camp.findUnique({
                where: { id: campId },
            });

            if (!camp) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Camp tidak ditemukan.",
                    },
                    { status: 404 },
                );
            }
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (existingUser) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Email sudah digunakan.",
                },
                { status: 409 },
            );
        }

        const passwordHash = await bcrypt.hash(String(password), 12);

        const user = await prisma.$transaction(async (tx) => {
            if (role === "MANAGER" && campId) {
                const campManager = await tx.camp.findUnique({ where: { id: campId }, select: { managerId: true } });
                if (campManager?.managerId) throw new Error("CAMP_MANAGER_EXISTS");
            }
            if (role === "DIVISION_HEAD" && campId && division) {
                const existingHead = await tx.campDivisionHead.findUnique({ where: { campId_division: { campId, division } }, select: { id: true } });
                if (existingHead) throw new Error("DIVISION_HEAD_EXISTS");
            }
			const created = await tx.user.create({
				data: {
					name: String(name).trim(),
					email: normalizedEmail,
					password: passwordHash,
					role,
					division: role === "SUPER_ADMIN" || role === "MANAGER" ? null : division,
					campId: role === "SUPER_ADMIN" ? null : campId,
					...(role === "MANAGER" && campId ? { managedCamp: { connect: { id: campId } } } : {}),
				},
				select: { id: true, name: true, email: true, role: true, division: true, campId: true },
			});
			if (role === "DIVISION_HEAD" && campId && division) await tx.campDivisionHead.create({ data: { campId, division, userId: created.id } });
			return created;
		});


        await writeAuditLog({ userId: currentUser.id, action: "CREATE", entity: "User", entityId: user.id, details: { name: user.name, role: user.role } });

        return NextResponse.json(
            {
                success: true,
                message: "User berhasil dibuat.",
                data: user,
            },
            { status: 201 },
        );
    } catch (error) {
        if (error instanceof Error && error.message === "CAMP_MANAGER_EXISTS") {
            return NextResponse.json({ success: false, message: "Posko tersebut sudah memiliki manager." }, { status: 409 });
        }
        if (error instanceof Error && error.message === "DIVISION_HEAD_EXISTS") {
            return NextResponse.json({ success: false, message: "Divisi tersebut sudah memiliki ketua di posko ini." }, { status: 409 });
        }
        if (isAuthError(error)) {
            return authError(error, "Hanya Super Admin.");
        }

        console.error("CREATE_USER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal membuat user." },
            { status: 500 },
        );
    }
}