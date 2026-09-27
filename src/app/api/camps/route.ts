import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth, requireRole } from "@/lib/auth/guard";
import { campValidationMessage, parseCampInput } from "@/lib/camp-validation";

export async function GET() {
	try {
		const user = await requireAuth();
		const camps = await prisma.camp.findMany({
			where: user.role === "SUPER_ADMIN" ? undefined : { id: user.campId ?? "" },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				name: true,
				address: true,
				latitude: true,
				longitude: true,
				maxCapacity: true,
				currentOccupants: true,
				status: true,
				managerId: true,
				manager: { select: { id: true, name: true, email: true } },
				divisionHeads: { include: { user: { select: { id: true, name: true, email: true } } } },
			},
		});
		return NextResponse.json({ success: true, data: camps });
	} catch (error) {
		if (isAuthError(error)) return authError(error);
		console.error("GET_CAMPS_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengambil data posko." }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		await requireRole("SUPER_ADMIN");
		const body = await request.json();
		let campInput;
		try {
			campInput = parseCampInput({ ...body, status: body.status ?? "ACTIVE" });
		} catch (validationError) {
			return NextResponse.json({ success: false, message: campValidationMessage(validationError) ?? "Data posko tidak valid." }, { status: 400 });
		}
		const camp = await prisma.camp.create({ data: campInput });
		return NextResponse.json({ success: true, message: "Posko berhasil dibuat. Tetapkan manager dan kepala divisi melalui Manajemen Pengguna.", data: camp }, { status: 201 });
	} catch (error) {
		if (isAuthError(error)) return authError(error, "Hanya Super Admin yang dapat membuat posko.");
		console.error("CREATE_CAMP_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal membuat posko." }, { status: 500 });
	}
}
