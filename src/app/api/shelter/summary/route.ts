import { canManageDivision, requireAuth } from "@/lib/auth/guard";
import { handleRouteError } from "@/lib/api-errors";
import { fail, ok } from "@/lib/api-response";
import { loadCampFacilityAssessments } from "@/lib/shelter";

// Panel "Kecukupan posko": Super Admin melihat semua posko aktif, lainnya hanya posko sendiri.
export async function GET() {
	try {
		const user = await requireAuth();
		if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "SHELTER", user.campId))) {
			return fail("Tidak memiliki akses ke divisi shelter posko ini.", 403);
		}

		const camps = await loadCampFacilityAssessments(
			user.role === "SUPER_ADMIN" ? { status: "ACTIVE" } : { id: user.campId! },
		);
		return ok(camps);
	} catch (error) {
		return handleRouteError(error, { context: "GET_SHELTER_SUMMARY_ERROR", fallback: "Gagal menghitung kecukupan fasilitas." });
	}
}
