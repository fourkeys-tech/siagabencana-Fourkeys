import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guard";

type Params = {
    params: Promise<{
        id: string;
    }>;
};

export async function GET(
    _request: Request,
    { params }: Params,
) {
    try {
        await requireRole("SUPER_ADMIN");

        const { id } = await params;

        const user = await prisma.user.findUnique({
            where: { id },
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
        if (error instanceof Error) {
            if (error.message === "UNAUTHORIZED") {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 },
                );
            }

            if (error.message === "FORBIDDEN") {
                return NextResponse.json(
                    { success: false, message: "Hanya Super Admin." },
                    { status: 403 },
                );
            }
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
        const currentUser = await requireRole("SUPER_ADMIN");

        const { id } = await params;
        const body = await request.json();

        const existingUser = await prisma.user.findUnique({
            where: { id },
        });

        if (!existingUser) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User tidak ditemukan.",
                },
                { status: 404 },
            );
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

        const role = body.role ?? existingUser.role;

        if (
            !["MANAGER", "FIELD_OFFICER", "SUPER_ADMIN"].includes(role)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Role tidak valid.",
                },
                { status: 400 },
            );
        }

        const division =
            body.division !== undefined
                ? body.division
                : existingUser.division;

        const campId =
            body.campId !== undefined
                ? body.campId
                : existingUser.campId;

        if (role !== "SUPER_ADMIN" && (!division || !campId)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Manager dan Field Officer wajib memiliki camp dan division.",
                },
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

        const data: {
            name?: string;
            email?: string;
            password?: string;
            role?: typeof role;
            division?: typeof division;
            campId?: typeof campId;
        } = {};

        if (body.name !== undefined) {
            data.name = String(body.name).trim();
        }

        if (body.email !== undefined) {
            const normalizedEmail = String(body.email)
                .trim()
                .toLowerCase();

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
            data.password = await bcrypt.hash(
                String(body.password),
                12,
            );
        }

        data.role = role;
        data.division = role === "SUPER_ADMIN" ? null : division;
        data.campId = role === "SUPER_ADMIN" ? null : campId;

        const user = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                division: true,
                campId: true,
            },
        });

        return NextResponse.json({
            success: true,
            message: "User berhasil diperbarui.",
            data: user,
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "UNAUTHORIZED") {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 },
                );
            }

            if (error.message === "FORBIDDEN") {
                return NextResponse.json(
                    { success: false, message: "Hanya Super Admin." },
                    { status: 403 },
                );
            }
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

        await prisma.user.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "User berhasil dihapus.",
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "UNAUTHORIZED") {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 },
                );
            }

            if (error.message === "FORBIDDEN") {
                return NextResponse.json(
                    { success: false, message: "Hanya Super Admin." },
                    { status: 403 },
                );
            }
        }

        console.error("DELETE_USER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal menghapus user." },
            { status: 500 },
        );
    }
}