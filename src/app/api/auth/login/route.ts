import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const email = body.email?.trim().toLowerCase();
        const password = body.password;

        if (!email || !password) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Email dan password wajib diisi.",
                },
                { status: 400 },
            );
        }

        const user = await prisma.user.findUnique({
            where: {
                email,
            },
        });

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Email atau password salah.",
                },
                { status: 401 },
            );
        }

        const passwordValid = await bcrypt.compare(
            password,
            user.password,
        );

        if (!passwordValid) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Email atau password salah.",
                },
                { status: 401 },
            );
        }

        await createSession(user.id);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                division: user.division,
                campId: user.campId,
            },
        });
    } catch (error) {
        console.error("LOGIN_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Terjadi kesalahan pada server.",
            },
            { status: 500 },
        );
    }
}