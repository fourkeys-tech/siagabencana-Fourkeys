import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { MAX_EMAIL_LENGTH } from "@/lib/validation";

// Rate limiting in-memory sederhana: maks 5 percobaan gagal per 15 menit per email
type RateLimitEntry = { attempts: number; resetAt: number };
const loginAttempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 menit

function isRateLimited(email: string): boolean {
    const entry = loginAttempts.get(email);
    if (!entry) return false;
    if (Date.now() > entry.resetAt) {
        loginAttempts.delete(email);
        return false;
    }
    return entry.attempts >= MAX_ATTEMPTS;
}

function recordFailedAttempt(email: string) {
    const entry = loginAttempts.get(email);
    if (!entry || Date.now() > entry.resetAt) {
        loginAttempts.set(email, { attempts: 1, resetAt: Date.now() + WINDOW_MS });
    } else {
        entry.attempts += 1;
    }
}

function resetAttempts(email: string) {
    loginAttempts.delete(email);
}

// Hash dummy (cost sama dengan hash user) agar waktu respons email tak terdaftar
// setara dengan password salah — mencegah enumerasi akun lewat timing.
const DUMMY_PASSWORD_HASH = "$2b$12$EBW.q9mwwU4G6sP7HfIbpue9YtTt5g3Suvo0Y9WemTT1pV4qqV/bS";

export async function POST(request: Request) {
    try {
        const body = await readJson(request);

        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (email.length > MAX_EMAIL_LENGTH || password.length > 128) {
            return NextResponse.json({ success: false, message: "Email atau password salah." }, { status: 401 });
        }

        if (!email || !password) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Email dan password wajib diisi.",
                },
                { status: 400 },
            );
        }

        if (isRateLimited(email)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Terlalu banyak percobaan login gagal. Silakan coba lagi setelah 15 menit.",
                },
                { status: 429 },
            );
        }

        const user = await prisma.user.findUnique({
            where: {
                email,
            },
        });

        if (!user) {
            await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
            recordFailedAttempt(email);
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
            recordFailedAttempt(email);
            await writeAuditLog({ userId: user.id, action: "LOGIN_FAILED", entity: "Session", details: { email: user.email } });
            return NextResponse.json(
                {
                    success: false,
                    message: "Email atau password salah.",
                },
                { status: 401 },
            );
        }

        resetAttempts(email);
        await createSession(user.id);

        // Opportunistic expired sessions cleanup
        prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
        await writeAuditLog({ userId: user.id, action: "LOGIN", entity: "Session", details: { email: user.email } });

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
        if (isInvalidJson(error)) return invalidJsonResponse();
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