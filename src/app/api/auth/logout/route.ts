import { NextResponse } from "next/server";
import { deleteSession, getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

const SESSION_COOKIE = "siaga_session";

export async function POST() {
    try {
        const user = await getCurrentUser();
        await deleteSession();
        if (user) await writeAuditLog({ userId: user.id, action: "LOGOUT", entity: "Session" });
    } catch (error) {
        // Logout tetap berhasil di sisi browser walau DB gagal; sesi kedaluwarsa dibersihkan cron.
        console.error("LOGOUT_ERROR", error);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
}
