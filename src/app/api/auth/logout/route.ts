import { NextResponse } from "next/server";
import { deleteSession, getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
    const user = await getCurrentUser();
    await deleteSession();
    if (user) await writeAuditLog({ userId: user.id, action: "LOGOUT", entity: "Session" });

    return NextResponse.json({
        success: true,
    });
}