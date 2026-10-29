import crypto from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "siaga_session";
const SESSION_DURATION = 1000 * 60 * 60 * 24 * 7; // 7 hari

function hashToken(token: string) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

export async function createSession(userId: string) {
    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = hashToken(token);

    const expiresAt = new Date(
        Date.now() + SESSION_DURATION,
    );

    await prisma.session.create({
        data: {
            tokenHash,
            userId,
            expiresAt,
        },
    });

    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
    });
}

export const getCurrentUser = cache(async () => {
    const cookieStore = await cookies();

    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (!token) {
        return null;
    }

    const tokenHash = hashToken(token);

    const session = await prisma.session.findUnique({
        where: {
            tokenHash,
        },
        select: {
            id: true,
            expiresAt: true,
            user: {
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
                            status: true,
                        },
                    },
                    managedCamp: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    divisionHeadAssignments: {
                        select: {
                            campId: true,
                            division: true,
                            camp: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!session) {
        return null;
    }

    if (session.expiresAt < new Date()) {
        // deleteMany: request paralel dengan sesi yang sama tidak gagal P2025.
        await prisma.session.deleteMany({
            where: {
                id: session.id,
            },
        });

        return null;
    }

    return session.user;
});

// Cabut semua sesi user (mis. setelah password direset oleh admin/manager).
export async function deleteUserSessions(userId: string) {
    await prisma.session.deleteMany({ where: { userId } });
}

// Cabut sesi lain milik user, pertahankan sesi pada perangkat saat ini.
export async function deleteOtherSessions(userId: string) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    await prisma.session.deleteMany({
        where: {
            userId,
            ...(token ? { NOT: { tokenHash: hashToken(token) } } : {}),
        },
    });
}

export async function deleteSession() {
    const cookieStore = await cookies();

    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
        const tokenHash = hashToken(token);

        await prisma.session.deleteMany({
            where: {
                tokenHash,
            },
        });
    }

    cookieStore.delete(SESSION_COOKIE);
}