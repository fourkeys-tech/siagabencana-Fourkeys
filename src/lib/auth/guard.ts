import { getCurrentUser } from "@/lib/auth/session";
import { Role, DivisionType } from "@prisma/client";
import { NextResponse } from "next/server";

export async function requireAuth() {
    const user = await getCurrentUser();

    if (!user) {
        throw new Error("UNAUTHORIZED");
    }

    return user;
}

export async function requireRole(...roles: Role[]) {
    const user = await requireAuth();

    if (!roles.includes(user.role)) {
        throw new Error("FORBIDDEN");
    }

    return user;
}

export async function requireDivision(division: DivisionType) {
    const user = await requireAuth();

    if (user.role === "SUPER_ADMIN") {
        return user;
    }

    if (user.division !== division) {
        throw new Error("FORBIDDEN");
    }

    return user;
}

export async function requireCampAccess(campId: string) {
    const user = await requireAuth();

    if (user.role === "SUPER_ADMIN") {
        return user;
    }

    if (user.campId !== campId) {
        throw new Error("FORBIDDEN");
    }

    return user;
}


export function authError(error: unknown) {
    if (error instanceof Error) {
        if (error.message === "UNAUTHORIZED") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized",
                },
                { status: 401 },
            );
        }

        if (error.message === "FORBIDDEN") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Forbidden",
                },
                { status: 403 },
            );
        }
    }

    return NextResponse.json(
        {
            success: false,
            message: "Internal server error",
        },
        { status: 500 },
    );
}