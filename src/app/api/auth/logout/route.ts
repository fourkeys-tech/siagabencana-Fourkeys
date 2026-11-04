import { after, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

const SESSION_COOKIE = "siaga_session";

export async function POST() {
    const userId = await deleteSession().catch((error: unknown) => {
        // Logout tetap berhasil di sisi browser walau DB gagal; sesi kedaluwarsa dibersihkan cron.
        console.error("LOGOUT_ERROR", error);
        return null;
    });

    // Audit log ditulis setelah respons terkirim agar tidak menahan logout.
    if (userId) after(() => writeAuditLog({ userId, action: "LOGOUT", entity: "Session" }));

    const response = NextResponse.json({ success: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
}
