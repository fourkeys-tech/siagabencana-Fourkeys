import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Client = Prisma.TransactionClient | typeof prisma;

// Operasi baru (registrasi, stok, laporan, penugasan) hanya boleh pada posko ACTIVE.
export async function assertCampActive(campId: string, client: Client = prisma) {
	const camp = await client.camp.findUnique({ where: { id: campId }, select: { id: true, status: true } });
	if (!camp) throw new Error("CAMP_NOT_FOUND");
	if (camp.status !== "ACTIVE") throw new Error("CAMP_NOT_ACTIVE");
	return camp;
}

export const CAMP_ERRORS: Record<string, { status: number; message: string }> = {
	CAMP_NOT_FOUND: { status: 404, message: "Posko tidak ditemukan." },
	CAMP_NOT_ACTIVE: { status: 409, message: "Posko sudah ditutup sehingga tidak dapat menerima operasi baru." },
};

export function campError(error: unknown) {
	return error instanceof Error ? CAMP_ERRORS[error.message] ?? null : null;
}
