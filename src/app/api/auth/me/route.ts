import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getCurrentUser();

    if (!user) {
        // Bedakan tamu (tanpa cookie) dari sesi yang kedaluwarsa/dicabut.
        const hasSessionCookie = (await cookies()).has("siaga_session");
        return NextResponse.json(
            {
                success: false,
                user: null,
                code: hasSessionCookie ? "SESSION_EXPIRED" : "NO_SESSION",
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
            camp: user.camp ? { id: user.camp.id, name: user.camp.name } : null,
            managedCamp: user.managedCamp,
            divisionHeadAssignments: user.divisionHeadAssignments.map((assignment) => ({ campId: assignment.campId, division: assignment.division, camp: assignment.camp })),
        },
    });
}