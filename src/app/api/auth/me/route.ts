import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json(
            {
                success: false,
                user: null,
            },
            { status: 401 },
        );
    }

    return NextResponse.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            division: user.division,
            campId: user.campId,
            camp: user.camp,
        },
    });
}