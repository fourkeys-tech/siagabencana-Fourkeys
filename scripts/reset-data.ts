/**
 * Kosongkan semua data operasional, sisakan akun SUPER_ADMIN apa adanya (password tidak diubah).
 *
 *   npx tsx scripts/reset-data.ts                                  # dry-run: hitung baris, tidak mengubah apa pun
 *   npx tsx scripts/reset-data.ts --apply --backup=<file.json>     # backup JSON penuh, lalu hapus dalam 1 transaksi
 *
 * File backup berisi data pribadi & hash password: simpan di luar repo dan hapus jika tidak diperlukan.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	console.error("DATABASE_URL is not set.");
	process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const apply = process.argv.includes("--apply");
const backupArg = process.argv.find((arg) => arg.startsWith("--backup="))?.slice("--backup=".length);

async function counts() {
	const [users, superAdmins, sessions, camps, divisionHeads, items, movements, requests, distributions, facilities, evacuees, auditLogs] = await Promise.all([
		prisma.user.count(),
		prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
		prisma.session.count(),
		prisma.camp.count(),
		prisma.campDivisionHead.count(),
		prisma.logisticsItem.count(),
		prisma.inventoryMovement.count(),
		prisma.logisticsRequest.count(),
		prisma.distribution.count(),
		prisma.facilityReport.count(),
		prisma.evacueeRecord.count(),
		prisma.auditLog.count(),
	]);
	return { users, superAdmins, sessions, camps, divisionHeads, items, movements, requests, distributions, facilities, evacuees, auditLogs };
}

async function backup(path: string) {
	const [users, sessions, camps, campDivisionHeads, logisticsItems, inventoryMovements, logisticsRequests, distributions, facilityReports, evacueeRecords, auditLogs] = await Promise.all([
		prisma.user.findMany(),
		prisma.session.findMany(),
		prisma.camp.findMany(),
		prisma.campDivisionHead.findMany(),
		prisma.logisticsItem.findMany(),
		prisma.inventoryMovement.findMany(),
		prisma.logisticsRequest.findMany(),
		prisma.distribution.findMany(),
		prisma.facilityReport.findMany(),
		prisma.evacueeRecord.findMany(),
		prisma.auditLog.findMany(),
	]);
	const data = { exportedAt: new Date().toISOString(), users, sessions, camps, campDivisionHeads, logisticsItems, inventoryMovements, logisticsRequests, distributions, facilityReports, evacueeRecords, auditLogs };
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(data));
	const rows = Object.values(data).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
	console.log(`Backup: ${rows} baris → ${path}`);
}

async function main() {
	console.log(`Database host: ${new URL(connectionString!).hostname}`);
	console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);

	const before = await counts();
	const superAdmins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { name: true, email: true }, orderBy: { createdAt: "asc" } });
	console.table(before);
	console.log("Akun SUPER_ADMIN yang dipertahankan:");
	for (const admin of superAdmins) console.log(`  - ${admin.name} <${admin.email}>`);

	if (superAdmins.length === 0) throw new Error("ABORT: tidak ada akun SUPER_ADMIN; reset dibatalkan agar sistem tidak terkunci.");
	if (!apply) {
		console.log("Dry-run selesai, tidak ada perubahan. Jalankan dengan --apply --backup=<file.json> untuk eksekusi.");
		return;
	}
	if (!backupArg) throw new Error("ABORT: --backup=<file.json> wajib diisi saat --apply.");

	await backup(resolve(backupArg));

	// Urutan mengikuti FK Restrict: ledger & distribusi dulu, posko & user terakhir. Tanpa TRUNCATE CASCADE
	// karena TRUNCATE "Camp" CASCADE ikut mengosongkan tabel "User" (FK campId).
	await prisma.$transaction(async (tx) => {
		await tx.inventoryMovement.deleteMany();
		await tx.distribution.deleteMany();
		await tx.logisticsRequest.deleteMany();
		await tx.logisticsItem.deleteMany();
		await tx.facilityReport.deleteMany();
		await tx.evacueeRecord.deleteMany();
		await tx.campDivisionHead.deleteMany();
		await tx.auditLog.deleteMany();
		await tx.session.deleteMany({ where: { user: { role: { not: "SUPER_ADMIN" } } } });
		await tx.user.updateMany({ where: { role: "SUPER_ADMIN" }, data: { campId: null, division: null } });
		await tx.camp.deleteMany();
		await tx.user.deleteMany({ where: { role: { not: "SUPER_ADMIN" } } });
	}, { timeout: 120_000 });

	const after = await counts();
	console.table(after);
	const leftovers = Object.entries(after).filter(([key, value]) => !["users", "superAdmins", "sessions"].includes(key) && value !== 0);
	if (leftovers.length > 0 || after.users !== after.superAdmins) throw new Error(`Reset tidak bersih: ${JSON.stringify(after)}`);
	console.log(`Reset selesai. Tersisa ${after.superAdmins} akun SUPER_ADMIN.`);
}

main()
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
