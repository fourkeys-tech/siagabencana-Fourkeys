import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guard";

export async function GET() {
    try {
        await requireRole("SUPER_ADMIN");

        const users = await prisma.user.findMany({
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

        console.error("GET_USERS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil data user." },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        await requireRole("SUPER_ADMIN");

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

        if (!["MANAGER", "FIELD_OFFICER", "SUPER_ADMIN"].includes(role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Role tidak valid.",
                },
                { status: 400 },
            );
        }

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

        const user = await prisma.user.create({
            data: {
                name: String(name).trim(),
                email: normalizedEmail,
                password: passwordHash,
                role,
                division: role === "SUPER_ADMIN" ? null : division,
                campId: role === "SUPER_ADMIN" ? null : campId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                division: true,
                campId: true,
            },
        });

        return NextResponse.json(
            {
                success: true,
                message: "User berhasil dibuat.",
                data: user,
            },
            { status: 201 },
        );
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

        console.error("CREATE_USER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal membuat user." },
            { status: 500 },
        );
    }
}