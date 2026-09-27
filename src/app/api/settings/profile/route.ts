import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";

export async function GET() {
	try {
		const user = await requireAuth();
		return NextResponse.json({
			success: true,
			data: {
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				division: user.division,
				campId: user.campId,
				camp: user.camp,
			},
		});
	} catch (error) {
		if (isAuthError(error)) return authError(error);
		console.error("GET_SETTINGS_PROFILE_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengambil profil." }, { status: 500 });
	}
}

export async function PUT(request: Request) {
	try {
		const user = await requireAuth();
		const body = await request.json();
		const name = String(body.name ?? "").trim();
		const email = String(body.email ?? "").trim().toLowerCase();

		if (!name || !email) {
			return NextResponse.json({ success: false, message: "Nama dan email wajib diisi." }, { status: 400 });
		}

		const owner = await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } });
		if (owner) {
			return NextResponse.json({ success: false, message: "Email sudah digunakan." }, { status: 409 });
		}

		const updated = await prisma.user.update({
			where: { id: user.id },
			data: { name, email },
			select: { id: true, name: true, email: true, role: true, division: true, campId: true, camp: true },
		});

		return NextResponse.json({ success: true, message: "Profil berhasil diperbarui.", data: updated });
	} catch (error) {
		if (isAuthError(error)) return authError(error);
		console.error("UPDATE_SETTINGS_PROFILE_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal memperbarui profil." }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	try {
		const user = await requireAuth();
		const body = await request.json();
		const currentPassword = String(body.currentPassword ?? "");
		const newPassword = String(body.newPassword ?? "");

		if (!currentPassword || newPassword.length < 6) {
			return NextResponse.json({ success: false, message: "Password lama wajib diisi dan password baru minimal 6 karakter." }, { status: 400 });
		}

		const valid = await bcrypt.compare(currentPassword, user.password);
		if (!valid) {
			return NextResponse.json({ success: false, message: "Password lama tidak sesuai." }, { status: 400 });
		}

		await prisma.user.update({
			where: { id: user.id },
			data: { password: await bcrypt.hash(newPassword, 12) },
		});

		return NextResponse.json({ success: true, message: "Password berhasil diubah." });
	} catch (error) {
		if (isAuthError(error)) return authError(error);
		console.error("UPDATE_SETTINGS_PASSWORD_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengubah password." }, { status: 500 });
	}
}
