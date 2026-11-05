import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as listShelter, POST as createShelter } from "@/app/api/shelter/route";
import { DELETE as deleteShelter, PUT as updateShelter } from "@/app/api/shelter/[id]/route";
import { GET as shelterSummary } from "@/app/api/shelter/summary/route";
import { GET as getReports } from "@/app/api/reports/route";
import { createCamp, createUser, describeDb, resetDatabase } from "./helpers";

const currentUser = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => currentUser.value }));

const json = (url: string, method: string, body: unknown) =>
	new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function read(response: Response) {
	return { status: response.status, ...(await response.json()) as { success: boolean; message?: string; data?: unknown } };
}

const create = (body: Record<string, unknown>) => createShelter(json("http://localhost/api/shelter", "POST", body));
const update = (id: string, body: Record<string, unknown>) => updateShelter(json(`http://localhost/api/shelter/${id}`, "PUT", body), params(id));

type Report = { id: string; category: string; quantity: number; status: string; description: string };

describeDb("fasilitas shelter: kategori, jumlah, dan kecukupan", () => {
	beforeEach(async () => {
		await resetDatabase();
		currentUser.value = await createUser({ role: "SUPER_ADMIN" });
	});

	afterAll(async () => prisma.$disconnect());

	it("membuat fasilitas dengan kategori & jumlah; jumlah kosong → 1", async () => {
		const camp = await createCamp();
		const toilet = await read(await create({ campId: camp.id, category: "toilet", facilityName: "MCK Blok A", quantity: "4", status: "GOOD", description: "Dekat dapur" }));
		expect(toilet).toMatchObject({ status: 201, success: true, data: { category: "TOILET", quantity: 4, status: "GOOD" } });

		const kitchen = await read(await create({ campId: camp.id, category: "KITCHEN", facilityName: "Dapur umum", quantity: "", description: "Utama" }));
		expect(kitchen.data).toMatchObject({ category: "KITCHEN", quantity: 1 });

		const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: "FacilityReport", action: "CREATE", entityId: (toilet.data as Report).id } });
		expect(audit.details).toContain("TOILET");
	});

	it("kategori/jumlah tidak valid → 400 dan tidak ada baris dibuat", async () => {
		const camp = await createCamp();
		const base = { campId: camp.id, facilityName: "Tenda", description: "-" };
		for (const body of [
			{ ...base },
			{ ...base, category: "SHELTER" },
			{ ...base, category: "HOUSING", quantity: 0 },
			{ ...base, category: "HOUSING", quantity: "2.5" },
			{ ...base, category: "HOUSING", quantity: -3 },
		]) {
			expect((await create(body)).status).toBe(400);
		}
		expect(await prisma.facilityReport.count()).toBe(0);
	});

	it("posko CLOSED ditolak", async () => {
		const camp = await createCamp({ status: "CLOSED" });
		const response = await create({ campId: camp.id, category: "TOILET", facilityName: "MCK", quantity: 2, description: "-" });
		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(await prisma.facilityReport.count()).toBe(0);
	});

	it("edit kategori & jumlah; status tidak bisa diubah lewat edit", async () => {
		const camp = await createCamp();
		const report = (await read(await create({ campId: camp.id, category: "OTHER", facilityName: "Toilet portabel", quantity: 1, description: "-" }))).data as Report;

		const edited = await read(await update(report.id, { category: "TOILET", quantity: "6" }));
		expect(edited).toMatchObject({ status: 200, data: { category: "TOILET", quantity: 6 } });

		expect((await update(report.id, { quantity: 0 })).status).toBe(400);
		expect((await update(report.id, { status: "DAMAGED" })).status).toBe(409);
		expect((await prisma.facilityReport.findUniqueOrThrow({ where: { id: report.id } })).status).toBe("GOOD");
	});

	it("lapor rusak sebagian memecah baris: sisa tetap Baik, unit rusak jadi laporan baru", async () => {
		const camp = await createCamp({ currentOccupants: 100 });
		const report = (await read(await create({ campId: camp.id, category: "TOILET", facilityName: "MCK Blok A", quantity: 10, description: "Awal" }))).data as Report;

		const result = await read(await update(report.id, { action: "REPORT_DAMAGE", note: "Saluran mampet", damagedQuantity: "3" }));
		expect(result.status).toBe(200);
		expect(result.message).toContain("Sisa 7");

		const rows = await prisma.facilityReport.findMany({ where: { campId: camp.id }, orderBy: { quantity: "desc" } });
		expect(rows.map((row) => [row.quantity, row.status, row.category])).toEqual([[7, "GOOD", "TOILET"], [3, "DAMAGED", "TOILET"]]);
		expect(rows[0]?.description).toContain("3 dari 10 rusak");

		// Kecukupan hanya menghitung unit Baik: 7 dari 5 dibutuhkan (100 jiwa) → cukup.
		const summary = await read(await shelterSummary());
		const camps = summary.data as Array<{ campId: string; assessment: { categories: Array<{ category: string; available: number; total: number; status: string }> } }>;
		const toilet = camps.find((item) => item.campId === camp.id)?.assessment.categories.find((item) => item.category === "TOILET");
		expect(toilet).toMatchObject({ available: 7, total: 10, status: "SUFFICIENT" });

		expect((await update(report.id, { action: "REPORT_DAMAGE", note: "x", damagedQuantity: 8 })).status).toBe(400);
	});

	it("lapor rusak penuh lalu alur perbaikan; transisi salah → 409", async () => {
		const camp = await createCamp();
		const report = (await read(await create({ campId: camp.id, category: "POWER", facilityName: "Genset", quantity: 1, description: "-" }))).data as Report;

		expect((await update(report.id, { action: "START_REPAIR", note: "x" })).status).toBe(409);
		expect((await update(report.id, { action: "REPORT_DAMAGE", note: "" })).status).toBe(400);

		expect((await update(report.id, { action: "REPORT_DAMAGE", note: "Mati total" })).status).toBe(200);
		expect((await update(report.id, { action: "START_REPAIR", note: "Teknisi datang" })).status).toBe(200);
		expect((await update(report.id, { action: "COMPLETE_REPAIR", note: "Normal" })).status).toBe(200);

		const after = await prisma.facilityReport.findUniqueOrThrow({ where: { id: report.id } });
		expect(after.status).toBe("GOOD");
		expect(after.description).toMatch(/\[REPORT_DAMAGE\] Mati total[\s\S]*\[START_REPAIR\][\s\S]*\[COMPLETE_REPAIR\]/);
		expect(await prisma.facilityReport.count()).toBe(1);
	});

	it("hapus hanya untuk status Baik; petugas lapangan tidak boleh hapus", async () => {
		const camp = await createCamp();
		const report = (await read(await create({ campId: camp.id, category: "WATER", facilityName: "Tandon", quantity: 2000, description: "-" }))).data as Report;
		await update(report.id, { action: "REPORT_DAMAGE", note: "Bocor" });

		expect((await deleteShelter(new Request("http://localhost"), params(report.id))).status).toBe(409);

		await update(report.id, { action: "START_REPAIR", note: "x" });
		await update(report.id, { action: "COMPLETE_REPAIR", note: "x" });

		currentUser.value = await createUser({ role: "FIELD_OFFICER", division: "SHELTER", campId: camp.id });
		expect((await deleteShelter(new Request("http://localhost"), params(report.id))).status).toBe(403);

		currentUser.value = await createUser({ role: "SUPER_ADMIN" });
		expect((await deleteShelter(new Request("http://localhost"), params(report.id))).status).toBe(200);
		expect(await prisma.facilityReport.count()).toBe(0);
	});

	it("ringkasan kecukupan: data belum lengkap vs di bawah standar; non-SA hanya posko sendiri", async () => {
		const short = await createCamp({ name: "Posko Kurang", currentOccupants: 100 });
		const other = await createCamp({ name: "Posko Lain", currentOccupants: 10 });
		await create({ campId: short.id, category: "TOILET", facilityName: "MCK", quantity: 2, description: "-" });

		const all = (await read(await shelterSummary())).data as Array<{ campName: string; assessment: { overall: string } }>;
		expect(all.find((camp) => camp.campName === "Posko Kurang")?.assessment.overall).toBe("SHORT");
		expect(all.find((camp) => camp.campName === "Posko Lain")?.assessment.overall).toBe("INCOMPLETE");

		currentUser.value = await createUser({ role: "MANAGER", campId: other.id });
		const own = (await read(await shelterSummary())).data as Array<{ campName: string }>;
		expect(own.map((camp) => camp.campName)).toEqual(["Posko Lain"]);
	});

	it("filter kategori di daftar", async () => {
		const camp = await createCamp();
		await create({ campId: camp.id, category: "TOILET", facilityName: "MCK", quantity: 2, description: "-" });
		await create({ campId: camp.id, category: "HEALTH", facilityName: "Pos PMI", quantity: 1, description: "-" });

		const list = await read(await listShelter(new Request("http://localhost/api/shelter?category=health")));
		expect((list.data as Report[]).map((row) => row.category)).toEqual(["HEALTH"]);
	});

	it("laporan menampilkan fasilitas yang masih rusak walau dilaporkan sebelum periode", async () => {
		const camp = await createCamp({ currentOccupants: 40 });
		const old = await prisma.facilityReport.create({
			data: { campId: camp.id, category: "TOILET", facilityName: "MCK lama", quantity: 2, status: "DAMAGED", description: "-", createdAt: new Date("2026-09-01T00:00:00Z") },
		});
		await prisma.$executeRaw`UPDATE "FacilityReport" SET "updatedAt" = '2026-09-01T00:00:00Z' WHERE id = ${old.id}`;
		const fine = await prisma.facilityReport.create({
			data: { campId: camp.id, category: "KITCHEN", facilityName: "Dapur lama", quantity: 1, status: "GOOD", description: "-", createdAt: new Date("2026-09-01T00:00:00Z") },
		});
		await prisma.$executeRaw`UPDATE "FacilityReport" SET "updatedAt" = '2026-09-01T00:00:00Z' WHERE id = ${fine.id}`;

		const report = await read(await getReports(new Request("http://localhost/api/reports?from=2026-11-01&to=2026-11-04")));
		const data = report.data as {
			summary: { campsBelowStandard: number; damagedFacilities: number };
			camps: Array<{ id: string; facilitySufficiency: string; facilitySummary: string }>;
			facilities: Array<{ id: string; categoryLabel: string; quantityFormatted: string }>;
		};

		expect(data.facilities.map((facility) => facility.id)).toEqual([old.id]);
		expect(data.facilities[0]).toMatchObject({ categoryLabel: "Toilet / MCK", quantityFormatted: "2 bilik" });
		expect(data.summary).toMatchObject({ damagedFacilities: 1, campsBelowStandard: 1 });
		expect(data.camps.find((row) => row.id === camp.id)).toMatchObject({ facilitySufficiency: "SHORT" });
		expect(data.camps.find((row) => row.id === camp.id)?.facilitySummary).toContain("Toilet / MCK kurang 2 bilik");
	});
});
