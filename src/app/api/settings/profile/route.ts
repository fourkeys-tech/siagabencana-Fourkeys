import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";
import { deleteOtherSessions } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { isValidEmail, MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, validatePassword, validateText } from "@/lib/validation";

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
				camp: user.camp ? { id: user.camp.id, name: user.camp.name, status: user.camp.status } : null,
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
		const body = await readJson(request);

		const nameError = validateText(body.name, "Nama", MAX_NAME_LENGTH);
		if (nameError) return NextResponse.json({ success: false, message: nameError }, { status: 400 });
		const name = String(body.name).trim();

		const email = String(body.email ?? "").trim().toLowerCase();
		if (!email || email.length > MAX_EMAIL_LENGTH || !isValidEmail(email)) {
			return NextResponse.json({ success: false, message: "Format email tidak valid." }, { status: 400 });
		}

		const owner = await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } });
		if (owner) {
			return NextResponse.json({ success: false, message: "Email sudah digunakan." }, { status: 409 });
		}

		const updated = await prisma.user.update({
			where: { id: user.id },
			data: { name, email },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				division: true,
				campId: true,
				camp: { select: { id: true, name: true, status: true } },
			},
		});

		await writeAuditLog({ userId: user.id, action: "UPDATE", entity: "User", entityId: user.id, details: { profileUpdated: true } });

		return NextResponse.json({ success: true, message: "Profil berhasil diperbarui.", data: updated });
	} catch (error) {
		if (isInvalidJson(error)) return invalidJsonResponse();
		if (isUniqueConstraintError(error)) return NextResponse.json({ success: false, message: "Email sudah digunakan." }, { status: 409 });
		if (isAuthError(error)) return authError(error);
		console.error("UPDATE_SETTINGS_PROFILE_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal memperbarui profil." }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	try {
		const user = await requireAuth();
		const body = await readJson(request);
		const currentPassword = String(body.currentPassword ?? "");
		const newPassword = String(body.newPassword ?? "");

		if (!currentPassword) {
			return NextResponse.json({ success: false, message: "Password lama wajib diisi." }, { status: 400 });
		}
		const passwordError = validatePassword(newPassword);
		if (passwordError) {
			return NextResponse.json({ success: false, message: passwordError }, { status: 400 });
		}

		const passwordRecord = await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } });
		if (!passwordRecord) return NextResponse.json({ success: false, message: "User tidak ditemukan." }, { status: 404 });

		const valid = await bcrypt.compare(currentPassword, passwordRecord.password);
		if (!valid) {
			return NextResponse.json({ success: false, message: "Password lama tidak sesuai." }, { status: 400 });
		}

		await prisma.user.update({
			where: { id: user.id },
			data: { password: await bcrypt.hash(newPassword, 12) },
		});
		// Sesi di perangkat lain dicabut; perangkat saat ini tetap login.
		await deleteOtherSessions(user.id);
		await writeAuditLog({ userId: user.id, action: "UPDATE", entity: "User", entityId: user.id, details: { passwordChanged: true } });

		return NextResponse.json({ success: true, message: "Password berhasil diubah. Sesi di perangkat lain telah dikeluarkan." });
	} catch (error) {
		if (isInvalidJson(error)) return invalidJsonResponse();
		if (isAuthError(error)) return authError(error);
		console.error("UPDATE_SETTINGS_PASSWORD_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengubah password." }, { status: 500 });
	}
}

