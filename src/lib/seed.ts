import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const password = process.env.SEED_PASSWORD || "password";
const seedAsOf = new Date(process.env.SEED_AS_OF || "2026-09-20T12:00:00.000Z");
const userIdMap = new Map<string, string>();

if (Number.isNaN(seedAsOf.getTime())) {
	throw new Error("SEED_AS_OF is not a valid date");
}

type RoleValue = "SUPER_ADMIN" | "MANAGER" | "DIVISION_HEAD" | "FIELD_OFFICER";
type DivisionValue = "LOGISTICS" | "SHELTER" | "DATA_REGISTRATION";
type CampStatusValue = "ACTIVE" | "CLOSED";
type ItemStatusValue = "SUFFICIENT" | "LOW" | "CRITICAL" | "SPOILED_OR_DAMAGED";
type FacilityStatusValue = "GOOD" | "DAMAGED" | "REPAIRING";
type DistributionStatusValue = "PENDING" | "REJECTED" | "RESERVED" | "SHIPPED" | "RECEIVED" | "CANCELLED";
	type MovementTypeValue = "RECEIPT" | "DAMAGE" | "LOSS" | "RESERVATION" | "RESERVATION_RELEASE" | "DISTRIBUTION_OUT" | "DISTRIBUTION_IN";
	type CampSeed = {
	id: string;
	key: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	maxCapacity: number;
	status: CampStatusValue;
};
	type UserSeed = {
	id: string;
	name: string;
	email: string;
	role: RoleValue;
	division: DivisionValue | null;
	campId: string | null;
};
	type LogisticsSeed = {
	id: string;
	campId: string;
	itemName: string;
	quantity: number;
	reservedQuantity: number;
	damagedQuantity: number;
	minimumQuantity: number;
	unit: string;
	status: ItemStatusValue;
	notes: string | null;
	createdById: string;
	damageQuantity?: number;
	lossQuantity?: number;
	inboundQuantity?: number;
	outboundQuantity?: number;
};
	type EvacueeSeed = {
	id: string;
	campId: string;
	name: string;
	totalFamily: number;
	hasSpecialNeeds: boolean;
	notes: string | null;
	arrivedAt: Date;
	departedAt: Date | null;
};
	type FacilitySeed = {
	id: string;
	campId: string;
	facilityName: string;
	status: FacilityStatusValue;
	description: string;
	createdAt: Date;
};
	type RequestSeed = {
	id: string;
	sourceCampId: string;
	destinationCampId: string;
	createdById: string;
	reviewedById: string | null;
	itemName: string;
	quantity: number;
	unit: string;
	notes: string;
	rejectionReason: string | null;
	status: DistributionStatusValue;
	createdAt: Date;
};
	type DistributionSeed = {
	id: string;
	requestId: string;
	sourceCampId: string;
	destinationCampId: string;
	sourceItemId: string;
	createdById: string;
	itemName: string;
	quantity: number;
	unit: string;
	notes: string;
	status: Exclude<DistributionStatusValue, "PENDING" | "REJECTED">;
	createdAt: Date;
	shippedAt: Date | null;
	receivedAt: Date | null;
};

type MovementSeed = {
	id: string;
	logisticsItemId: string;
	campId: string;
	type: MovementTypeValue;
	quantity: number;
	reason: string | null;
	createdById: string;
	distributionId: string | null;
	createdAt: Date;
};

const divisions: DivisionValue[] = ["LOGISTICS", "SHELTER", "DATA_REGISTRATION"];

const camps: CampSeed[] = [
	{
		id: "seed-camp-candi",
		key: "candi",
		name: "Posko Evakuasi Balai Desa Candi",
		address: "Balai Desa Candi, Sidoarjo",
		latitude: -7.4716,
		longitude: 112.6946,
		maxCapacity: 220,
		status: "ACTIVE",
	},
	{
		id: "seed-camp-gor-sidoarjo",
		key: "gor-sidoarjo",
		name: "Posko Evakuasi GOR Sidoarjo",
		address: "GOR Sidoarjo, Sidoarjo",
		latitude: -7.4478,
		longitude: 112.7183,
		maxCapacity: 450,
		status: "ACTIVE",
	},
	{
		id: "seed-camp-taman",
		key: "taman",
		name: "Posko Evakuasi Lapangan Taman",
		address: "Lapangan Taman, Sidoarjo",
		latitude: -7.3645,
		longitude: 112.6974,
		maxCapacity: 280,
		status: "ACTIVE",
	},
	{
		id: "seed-camp-waru",
		key: "waru",
		name: "Posko Evakuasi Balai Kecamatan Waru",
		address: "Balai Kecamatan Waru, Sidoarjo",
		latitude: -7.3525,
		longitude: 112.7314,
		maxCapacity: 180,
		status: "ACTIVE",
	},
	{
		id: "seed-camp-gedangan",
		key: "gedangan",
		name: "Posko Evakuasi Gedangan Lama",
		address: "Gedung Serbaguna Gedangan, Sidoarjo",
		latitude: -7.3984,
		longitude: 112.6948,
		maxCapacity: 150,
		status: "CLOSED",
	},
];

const dateDaysAgo = (days: number, hours = 0) => new Date(seedAsOf.getTime() - ((days * 24 + hours) * 60 * 60 * 1000));

function createUsers() {
	const admin: UserSeed = {
		id: "seed-user-admin",
		name: "Super Administrator",
		email: "admin@siagabencana.local",
		role: "SUPER_ADMIN",
		division: null,
		campId: null,
	};
	const users: UserSeed[] = [admin];
	const managers = new Map<string, UserSeed>();
	const heads = new Map<string, UserSeed>();
	const officers = new Map<string, UserSeed>();

	for (const camp of camps) {
		const manager: UserSeed = {
			id: `seed-user-manager-${camp.key}`,
			name: `Manager ${camp.name.replace("Posko Evakuasi ", "")}`,
			email: `manager.${camp.key}@siagabencana.local`,
			role: "MANAGER",
			division: null,
			campId: camp.id,
		};
		users.push(manager);
		managers.set(camp.id, manager);

		for (const division of divisions) {
			const divisionKey = division.toLowerCase();
			const head: UserSeed = {
				id: `seed-user-head-${camp.key}-${divisionKey}`,
				name: `Head ${divisionKey} ${camp.key}`,
				email: `head.${divisionKey}.${camp.key}@siagabencana.local`,
				role: "DIVISION_HEAD",
				division,
				campId: camp.id,
			};
			users.push(head);
			heads.set(`${camp.id}:${division}`, head);

			for (const sequence of [1, 2]) {
				const officer: UserSeed = {
					id: `seed-user-field-${camp.key}-${divisionKey}-${sequence}`,
					name: `Field Officer ${divisionKey} ${camp.key} ${String(sequence).padStart(2, "0")}`,
					email: `field.${divisionKey}.${camp.key}.${String(sequence).padStart(2, "0")}@siagabencana.local`,
					role: "FIELD_OFFICER",
					division,
					campId: camp.id,
				};
				users.push(officer);
				officers.set(`${camp.id}:${division}:${sequence}`, officer);
			}
		}
	}

	return { admin, users, managers, heads, officers };
}

const evacuees: EvacueeSeed[] = [
	{ id: "seed-evacuee-candi-01", campId: "seed-camp-candi", name: "Keluarga Budi Santoso", totalFamily: 26, hasSpecialNeeds: false, notes: "Datang dari Desa Kedungpeluk.", arrivedAt: dateDaysAgo(18), departedAt: null },
	{ id: "seed-evacuee-candi-02", campId: "seed-camp-candi", name: "Keluarga Siti Aminah", totalFamily: 22, hasSpecialNeeds: true, notes: "Dua anggota keluarga lansia.", arrivedAt: dateDaysAgo(17), departedAt: null },
	{ id: "seed-evacuee-candi-03", campId: "seed-camp-candi", name: "Keluarga Andi Pratama", totalFamily: 18, hasSpecialNeeds: false, notes: "Membutuhkan area keluarga dekat toilet.", arrivedAt: dateDaysAgo(15), departedAt: null },
	{ id: "seed-evacuee-candi-04", campId: "seed-camp-candi", name: "Keluarga Rina Wulandari", totalFamily: 16, hasSpecialNeeds: true, notes: "Satu anak membutuhkan obat rutin.", arrivedAt: dateDaysAgo(14), departedAt: null },
	{ id: "seed-evacuee-candi-05", campId: "seed-camp-candi", name: "Keluarga Hendra Wijaya", totalFamily: 15, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(12), departedAt: null },
	{ id: "seed-evacuee-candi-06", campId: "seed-camp-candi", name: "Keluarga Nur Aini", totalFamily: 12, hasSpecialNeeds: false, notes: "Membawa bayi usia delapan bulan.", arrivedAt: dateDaysAgo(10), departedAt: null },
	{ id: "seed-evacuee-candi-07", campId: "seed-camp-candi", name: "Keluarga Fajar Nugroho", totalFamily: 9, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(9), departedAt: null },
	{ id: "seed-evacuee-candi-08", campId: "seed-camp-candi", name: "Keluarga Lestari", totalFamily: 6, hasSpecialNeeds: false, notes: "Kembali ke rumah pada siang hari untuk mengambil dokumen.", arrivedAt: dateDaysAgo(7), departedAt: null },
	{ id: "seed-evacuee-candi-09", campId: "seed-camp-candi", name: "Keluarga Rahman", totalFamily: 8, hasSpecialNeeds: false, notes: "Sudah kembali ke rumah.", arrivedAt: dateDaysAgo(24), departedAt: dateDaysAgo(5) },
	{ id: "seed-evacuee-gor-01", campId: "seed-camp-gor-sidoarjo", name: "Keluarga Hasan Basri", totalFamily: 58, hasSpecialNeeds: false, notes: "Kelompok keluarga dari wilayah utara.", arrivedAt: dateDaysAgo(19), departedAt: null },
	{ id: "seed-evacuee-gor-02", campId: "seed-camp-gor-sidoarjo", name: "Keluarga Dewi Kartika", totalFamily: 54, hasSpecialNeeds: true, notes: "Tiga anggota keluarga membutuhkan akses khusus.", arrivedAt: dateDaysAgo(18), departedAt: null },
	{ id: "seed-evacuee-gor-03", campId: "seed-camp-gor-sidoarjo", name: "Keluarga Yusuf Hidayat", totalFamily: 50, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(16), departedAt: null },
	{ id: "seed-evacuee-gor-04", campId: "seed-camp-gor-sidoarjo", name: "Keluarga Maya Sari", totalFamily: 48, hasSpecialNeeds: false, notes: "Membutuhkan tambahan selimut.", arrivedAt: dateDaysAgo(15), departedAt: null },
	{ id: "seed-evacuee-gor-05", campId: "seed-camp-gor-sidoarjo", name: "Keluarga Dimas Ramadhan", totalFamily: 45, hasSpecialNeeds: true, notes: "Satu anggota keluarga menggunakan kursi roda.", arrivedAt: dateDaysAgo(13), departedAt: null },
	{ id: "seed-evacuee-gor-06", campId: "seed-camp-gor-sidoarjo", name: "Keluarga Sulastri", totalFamily: 42, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(12), departedAt: null },
	{ id: "seed-evacuee-gor-07", campId: "seed-camp-gor-sidoarjo", name: "Keluarga Bagus Setiawan", totalFamily: 38, hasSpecialNeeds: false, notes: "Memerlukan informasi relokasi lanjutan.", arrivedAt: dateDaysAgo(10), departedAt: null },
	{ id: "seed-evacuee-gor-08", campId: "seed-camp-gor-sidoarjo", name: "Keluarga Ningsih", totalFamily: 15, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(8), departedAt: null },
	{ id: "seed-evacuee-gor-09", campId: "seed-camp-gor-sidoarjo", name: "Keluarga Wahyu", totalFamily: 12, hasSpecialNeeds: false, notes: "Sudah check-out.", arrivedAt: dateDaysAgo(25), departedAt: dateDaysAgo(6) },
	{ id: "seed-evacuee-taman-01", campId: "seed-camp-taman", name: "Keluarga Joko Susilo", totalFamily: 46, hasSpecialNeeds: false, notes: "Datang dari kawasan bantaran sungai.", arrivedAt: dateDaysAgo(20), departedAt: null },
	{ id: "seed-evacuee-taman-02", campId: "seed-camp-taman", name: "Keluarga Wati Lestari", totalFamily: 42, hasSpecialNeeds: true, notes: "Satu anggota keluarga lansia.", arrivedAt: dateDaysAgo(19), departedAt: null },
	{ id: "seed-evacuee-taman-03", campId: "seed-camp-taman", name: "Keluarga Arif Maulana", totalFamily: 40, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(17), departedAt: null },
	{ id: "seed-evacuee-taman-04", campId: "seed-camp-taman", name: "Keluarga Yuni Astuti", totalFamily: 36, hasSpecialNeeds: true, notes: "Membutuhkan susu formula.", arrivedAt: dateDaysAgo(16), departedAt: null },
	{ id: "seed-evacuee-taman-05", campId: "seed-camp-taman", name: "Keluarga Taufik Hidayat", totalFamily: 34, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(14), departedAt: null },
	{ id: "seed-evacuee-taman-06", campId: "seed-camp-taman", name: "Keluarga Lia Anggraini", totalFamily: 28, hasSpecialNeeds: false, notes: "Membawa dua balita.", arrivedAt: dateDaysAgo(12), departedAt: null },
	{ id: "seed-evacuee-taman-07", campId: "seed-camp-taman", name: "Keluarga Seno", totalFamily: 22, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(11), departedAt: null },
	{ id: "seed-evacuee-taman-08", campId: "seed-camp-taman", name: "Keluarga Kurniawan", totalFamily: 10, hasSpecialNeeds: false, notes: "Sudah kembali ke rumah.", arrivedAt: dateDaysAgo(22), departedAt: dateDaysAgo(4) },
	{ id: "seed-evacuee-waru-01", campId: "seed-camp-waru", name: "Keluarga Agus Salim", totalFamily: 18, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(13), departedAt: null },
	{ id: "seed-evacuee-waru-02", campId: "seed-camp-waru", name: "Keluarga Nita Permata", totalFamily: 16, hasSpecialNeeds: true, notes: "Satu anggota keluarga penyandang disabilitas.", arrivedAt: dateDaysAgo(12), departedAt: null },
	{ id: "seed-evacuee-waru-03", campId: "seed-camp-waru", name: "Keluarga Rudi Hartono", totalFamily: 14, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(10), departedAt: null },
	{ id: "seed-evacuee-waru-04", campId: "seed-camp-waru", name: "Keluarga Intan", totalFamily: 12, hasSpecialNeeds: false, notes: "Membawa bayi.", arrivedAt: dateDaysAgo(9), departedAt: null },
	{ id: "seed-evacuee-waru-05", campId: "seed-camp-waru", name: "Keluarga Sumarno", totalFamily: 12, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(7), departedAt: null },
	{ id: "seed-evacuee-waru-06", campId: "seed-camp-waru", name: "Keluarga Iqbal", totalFamily: 10, hasSpecialNeeds: false, notes: null, arrivedAt: dateDaysAgo(6), departedAt: null },
	{ id: "seed-evacuee-waru-07", campId: "seed-camp-waru", name: "Keluarga Farida", totalFamily: 8, hasSpecialNeeds: false, notes: "Sudah check-out.", arrivedAt: dateDaysAgo(21), departedAt: dateDaysAgo(3) },
	{ id: "seed-evacuee-gedangan-01", campId: "seed-camp-gedangan", name: "Keluarga Mulyono", totalFamily: 24, hasSpecialNeeds: false, notes: "Riwayat evakuasi sebelum posko ditutup.", arrivedAt: dateDaysAgo(48), departedAt: dateDaysAgo(35) },
	{ id: "seed-evacuee-gedangan-02", campId: "seed-camp-gedangan", name: "Keluarga Sari", totalFamily: 18, hasSpecialNeeds: true, notes: "Sudah dipindahkan ke posko Candi.", arrivedAt: dateDaysAgo(46), departedAt: dateDaysAgo(33) },
];

const facilities: FacilitySeed[] = camps.flatMap((camp) => [
	{ id: `seed-facility-${camp.key}-toilet`, campId: camp.id, facilityName: "Toilet", status: camp.key === "taman" ? "REPAIRING" : "GOOD", description: camp.key === "taman" ? "Dua bilik toilet perlu perbaikan saluran air." : "Toilet berfungsi dan dibersihkan tiga kali sehari.", createdAt: dateDaysAgo(14) },
	{ id: `seed-facility-${camp.key}-water`, campId: camp.id, facilityName: "Penyediaan Air", status: camp.key === "gor-sidoarjo" ? "DAMAGED" : "GOOD", description: camp.key === "gor-sidoarjo" ? "Pompa utama mengalami gangguan dan membutuhkan suku cadang." : "Tandon air dan jalur distribusi masih berfungsi normal.", createdAt: dateDaysAgo(12) },
	{ id: `seed-facility-${camp.key}-electricity`, campId: camp.id, facilityName: "Listrik", status: camp.key === "waru" ? "REPAIRING" : "GOOD", description: camp.key === "waru" ? "Panel cadangan sedang diperbaiki oleh teknisi." : "Penerangan utama tersedia sepanjang waktu.", createdAt: dateDaysAgo(10) },
	{ id: `seed-facility-${camp.key}-tent`, campId: camp.id, facilityName: "Tenda Pengungsian", status: camp.key === "candi" || camp.key === "gedangan" ? "DAMAGED" : "GOOD", description: camp.key === "candi" || camp.key === "gedangan" ? "Sebagian tenda mengalami kebocoran pada sambungan atas." : "Tenda utama kokoh dan memiliki jalur evakuasi yang jelas.", createdAt: dateDaysAgo(8) },
	{ id: `seed-facility-${camp.key}-medical`, campId: camp.id, facilityName: "Pos Kesehatan", status: camp.key === "taman" ? "DAMAGED" : "GOOD", description: camp.key === "taman" ? "Atap pos kesehatan perlu diperbaiki sebelum hujan berikutnya." : "Pos kesehatan memiliki meja pemeriksaan dan lemari obat.", createdAt: dateDaysAgo(6) },
]);

const userData = createUsers();
const managerFor = (campId: string) => userData.managers.get(campId) as UserSeed;
const headFor = (campId: string, division: DivisionValue) => userData.heads.get(`${campId}:${division}`) as UserSeed;
const logisticsItems: LogisticsSeed[] = [
	{ id: "seed-item-candi-rice", campId: "seed-camp-candi", itemName: "Beras", quantity: 520, reservedQuantity: 80, damagedQuantity: 0, minimumQuantity: 120, unit: "kg", status: "SUFFICIENT", notes: "Stok utama untuk dapur umum.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-water", campId: "seed-camp-candi", itemName: "Air Mineral", quantity: 180, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 100, unit: "dus", status: "SUFFICIENT", notes: "Distribusi harian dicatat oleh tim logistik.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-medicine", campId: "seed-camp-candi", itemName: "Obat-obatan", quantity: 32, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 40, unit: "box", status: "LOW", notes: "Prioritas pengadaan untuk pos kesehatan.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-blanket", campId: "seed-camp-candi", itemName: "Selimut", quantity: 5, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "pcs", status: "CRITICAL", notes: "Stok hampir habis.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-hygiene", campId: "seed-camp-candi", itemName: "Hygiene Kit", quantity: 42, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 15, unit: "paket", status: "SUFFICIENT", notes: "Sebagian dikirim ke Posko Waru.", createdById: headFor("seed-camp-candi", "LOGISTICS").id, outboundQuantity: 30 },
	{ id: "seed-item-candi-tarpaulin", campId: "seed-camp-candi", itemName: "Terpal", quantity: 24, reservedQuantity: 0, damagedQuantity: 6, minimumQuantity: 10, unit: "pcs", status: "SPOILED_OR_DAMAGED", notes: "Enam unit rusak karena penyimpanan lembap.", createdById: headFor("seed-camp-candi", "LOGISTICS").id, damageQuantity: 6 },
	{ id: "seed-item-gor-rice", campId: "seed-camp-gor-sidoarjo", itemName: "Beras", quantity: 260, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 100, unit: "kg", status: "SUFFICIENT", notes: "Stok aman untuk dapur umum besar.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id },
	{ id: "seed-item-gor-water", campId: "seed-camp-gor-sidoarjo", itemName: "Air Mineral", quantity: 50, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 80, unit: "dus", status: "LOW", notes: "Sebagian dikirim ke Posko Taman.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, outboundQuantity: 40 },
	{ id: "seed-item-gor-hygiene", campId: "seed-camp-gor-sidoarjo", itemName: "Hygiene Kit", quantity: 0, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "paket", status: "CRITICAL", notes: "Pengadaan baru sedang menunggu.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, lossQuantity: 15 },
	{ id: "seed-item-gor-ready-meal", campId: "seed-camp-gor-sidoarjo", itemName: "Makanan Siap Saji", quantity: 180, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 70, unit: "dus", status: "SUFFICIENT", notes: "Untuk kebutuhan makan tiga hari.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id },
	{ id: "seed-item-gor-generator", campId: "seed-camp-gor-sidoarjo", itemName: "Generator", quantity: 8, reservedQuantity: 0, damagedQuantity: 2, minimumQuantity: 2, unit: "unit", status: "SPOILED_OR_DAMAGED", notes: "Dua unit perlu servis berat.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, damageQuantity: 2 },
	{ id: "seed-item-taman-rice", campId: "seed-camp-taman", itemName: "Beras", quantity: 45, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 80, unit: "kg", status: "LOW", notes: "Pernah memiliki reservasi yang dibatalkan.", createdById: headFor("seed-camp-taman", "LOGISTICS").id },
	{ id: "seed-item-taman-water", campId: "seed-camp-taman", itemName: "Air Mineral", quantity: 40, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 30, unit: "dus", status: "SUFFICIENT", notes: "Tambahan stok dari Posko GOR.", createdById: headFor("seed-camp-taman", "LOGISTICS").id, inboundQuantity: 40 },
	{ id: "seed-item-taman-ready-meal", campId: "seed-camp-taman", itemName: "Makanan Siap Saji", quantity: 160, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 50, unit: "dus", status: "SUFFICIENT", notes: "Stok untuk kondisi darurat.", createdById: headFor("seed-camp-taman", "LOGISTICS").id },
	{ id: "seed-item-taman-blanket", campId: "seed-camp-taman", itemName: "Selimut", quantity: 12, reservedQuantity: 0, damagedQuantity: 2, minimumQuantity: 10, unit: "pcs", status: "SPOILED_OR_DAMAGED", notes: "Dua unit rusak karena terkena air.", createdById: headFor("seed-camp-taman", "LOGISTICS").id, damageQuantity: 2 },
	{ id: "seed-item-taman-hygiene", campId: "seed-camp-taman", itemName: "Hygiene Kit", quantity: 18, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "paket", status: "LOW", notes: "Perlu penambahan sebelum akhir pekan.", createdById: headFor("seed-camp-taman", "LOGISTICS").id },
	{ id: "seed-item-waru-rice", campId: "seed-camp-waru", itemName: "Beras", quantity: 100, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 30, unit: "kg", status: "SUFFICIENT", notes: null, createdById: headFor("seed-camp-waru", "LOGISTICS").id },
	{ id: "seed-item-waru-water", campId: "seed-camp-waru", itemName: "Air Mineral", quantity: 35, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 40, unit: "dus", status: "LOW", notes: "Konsumsi meningkat karena cuaca panas.", createdById: headFor("seed-camp-waru", "LOGISTICS").id },
	{ id: "seed-item-waru-hygiene", campId: "seed-camp-waru", itemName: "Hygiene Kit", quantity: 42, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "paket", status: "SUFFICIENT", notes: "Tambahan stok diterima dari Posko Candi.", createdById: headFor("seed-camp-waru", "LOGISTICS").id, inboundQuantity: 30 },
	{ id: "seed-item-waru-medicine", campId: "seed-camp-waru", itemName: "Obat-obatan", quantity: 22, reservedQuantity: 0, damagedQuantity: 2, minimumQuantity: 10, unit: "box", status: "SPOILED_OR_DAMAGED", notes: "Dua box rusak dan dipisahkan.", createdById: headFor("seed-camp-waru", "LOGISTICS").id, damageQuantity: 2 },
	{ id: "seed-item-waru-lamp", campId: "seed-camp-waru", itemName: "Lampu Tenaga Surya", quantity: 14, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 15, unit: "unit", status: "LOW", notes: "Sebagian area masih membutuhkan penerangan.", createdById: headFor("seed-camp-waru", "LOGISTICS").id },
	{ id: "seed-item-gedangan-rice", campId: "seed-camp-gedangan", itemName: "Beras", quantity: 150, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 40, unit: "kg", status: "SUFFICIENT", notes: "Stok tersisa dari operasional sebelum posko ditutup.", createdById: headFor("seed-camp-gedangan", "LOGISTICS").id },
	{ id: "seed-item-gedangan-water", campId: "seed-camp-gedangan", itemName: "Air Mineral", quantity: 50, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "dus", status: "SUFFICIENT", notes: "Tidak digunakan setelah posko ditutup.", createdById: headFor("seed-camp-gedangan", "LOGISTICS").id },
	{ id: "seed-item-gedangan-blanket", campId: "seed-camp-gedangan", itemName: "Selimut", quantity: 25, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 10, unit: "pcs", status: "SUFFICIENT", notes: "Akan dialihkan bila posko dibuka kembali.", createdById: headFor("seed-camp-gedangan", "LOGISTICS").id },
	{ id: "seed-item-gedangan-hygiene", campId: "seed-camp-gedangan", itemName: "Hygiene Kit", quantity: 30, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 10, unit: "paket", status: "SUFFICIENT", notes: null, createdById: headFor("seed-camp-gedangan", "LOGISTICS").id },
	{ id: "seed-item-gedangan-medicine", campId: "seed-camp-gedangan", itemName: "Obat-obatan", quantity: 10, reservedQuantity: 0, damagedQuantity: 1, minimumQuantity: 5, unit: "box", status: "SPOILED_OR_DAMAGED", notes: "Satu box melewati masa simpan.", createdById: headFor("seed-camp-gedangan", "LOGISTICS").id, damageQuantity: 1 },
];

const requests: RequestSeed[] = [
	{ id: "seed-request-pending-candi-gor-rice", sourceCampId: "seed-camp-candi", destinationCampId: "seed-camp-gor-sidoarjo", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, reviewedById: null, itemName: "Beras", quantity: 50, unit: "kg", notes: "Permintaan tambahan untuk dapur umum akhir pekan.", rejectionReason: null, status: "PENDING", createdAt: dateDaysAgo(1, 4) },
	{ id: "seed-request-rejected-taman-waru-water", sourceCampId: "seed-camp-taman", destinationCampId: "seed-camp-waru", createdById: headFor("seed-camp-waru", "LOGISTICS").id, reviewedById: headFor("seed-camp-taman", "LOGISTICS").id, itemName: "Air Mineral", quantity: 30, unit: "dus", notes: "Permintaan untuk penambahan buffer air.", rejectionReason: "Stok sumber diprioritaskan untuk kebutuhan posko yang hampir penuh.", status: "REJECTED", createdAt: dateDaysAgo(4), },
	{ id: "seed-request-reserved-candi-taman-rice", sourceCampId: "seed-camp-candi", destinationCampId: "seed-camp-taman", createdById: headFor("seed-camp-taman", "LOGISTICS").id, reviewedById: headFor("seed-camp-candi", "LOGISTICS").id, itemName: "Beras", quantity: 80, unit: "kg", notes: "Pengiriman beras untuk menjaga stok minimum Posko Taman.", rejectionReason: null, status: "RESERVED", createdAt: dateDaysAgo(5), },
	{ id: "seed-request-shipped-gor-taman-water", sourceCampId: "seed-camp-gor-sidoarjo", destinationCampId: "seed-camp-taman", createdById: headFor("seed-camp-taman", "LOGISTICS").id, reviewedById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, itemName: "Air Mineral", quantity: 40, unit: "dus", notes: "Pengiriman air untuk posko dengan okupansi tinggi.", rejectionReason: null, status: "SHIPPED", createdAt: dateDaysAgo(7), },
	{ id: "seed-request-received-candi-waru-hygiene", sourceCampId: "seed-camp-candi", destinationCampId: "seed-camp-waru", createdById: headFor("seed-camp-waru", "LOGISTICS").id, reviewedById: headFor("seed-camp-candi", "LOGISTICS").id, itemName: "Hygiene Kit", quantity: 30, unit: "paket", notes: "Bantuan hygiene kit untuk keluarga dengan anak kecil.", rejectionReason: null, status: "RECEIVED", createdAt: dateDaysAgo(11), },
	{ id: "seed-request-cancelled-taman-candi-rice", sourceCampId: "seed-camp-taman", destinationCampId: "seed-camp-candi", createdById: headFor("seed-camp-candi", "LOGISTICS").id, reviewedById: headFor("seed-camp-taman", "LOGISTICS").id, itemName: "Beras", quantity: 20, unit: "kg", notes: "Permintaan dibatalkan setelah pasokan lokal tiba.", rejectionReason: null, status: "CANCELLED", createdAt: dateDaysAgo(9), },
];

const distributions: DistributionSeed[] = [
	{ id: "seed-distribution-reserved-candi-taman-rice", requestId: "seed-request-reserved-candi-taman-rice", sourceCampId: "seed-camp-candi", destinationCampId: "seed-camp-taman", sourceItemId: "seed-item-candi-rice", createdById: headFor("seed-camp-candi", "LOGISTICS").id, itemName: "Beras", quantity: 80, unit: "kg", notes: "Pengiriman beras untuk menjaga stok minimum Posko Taman.", status: "RESERVED", createdAt: dateDaysAgo(5, 2), shippedAt: null, receivedAt: null },
	{ id: "seed-distribution-shipped-gor-taman-water", requestId: "seed-request-shipped-gor-taman-water", sourceCampId: "seed-camp-gor-sidoarjo", destinationCampId: "seed-camp-taman", sourceItemId: "seed-item-gor-water", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, itemName: "Air Mineral", quantity: 40, unit: "dus", notes: "Pengiriman air untuk posko dengan okupansi tinggi.", status: "SHIPPED", createdAt: dateDaysAgo(7, 2), shippedAt: dateDaysAgo(2), receivedAt: null },
	{ id: "seed-distribution-received-candi-waru-hygiene", requestId: "seed-request-received-candi-waru-hygiene", sourceCampId: "seed-camp-candi", destinationCampId: "seed-camp-waru", sourceItemId: "seed-item-candi-hygiene", createdById: headFor("seed-camp-candi", "LOGISTICS").id, itemName: "Hygiene Kit", quantity: 30, unit: "paket", notes: "Bantuan hygiene kit untuk keluarga dengan anak kecil.", status: "RECEIVED", createdAt: dateDaysAgo(11, 2), shippedAt: dateDaysAgo(6), receivedAt: dateDaysAgo(4), },
	{ id: "seed-distribution-cancelled-taman-candi-rice", requestId: "seed-request-cancelled-taman-candi-rice", sourceCampId: "seed-camp-taman", destinationCampId: "seed-camp-candi", sourceItemId: "seed-item-taman-rice", createdById: headFor("seed-camp-taman", "LOGISTICS").id, itemName: "Beras", quantity: 20, unit: "kg", notes: "Permintaan dibatalkan setelah pasokan lokal tiba.", status: "CANCELLED", createdAt: dateDaysAgo(9, 2), shippedAt: null, receivedAt: null },
];

const movements: MovementSeed[] = [];

for (const item of logisticsItems) {
	const receiptQuantity = item.quantity + (item.damageQuantity || 0) + (item.lossQuantity || 0) + (item.outboundQuantity || 0) - (item.inboundQuantity || 0);
	if (receiptQuantity > 0) {
		movements.push({ id: `${item.id}-receipt`, logisticsItemId: item.id, campId: item.campId, type: "RECEIPT", quantity: receiptQuantity, reason: "Penerimaan stok awal fixture", createdById: item.createdById, distributionId: null, createdAt: dateDaysAgo(30) });
	}
	if (item.damageQuantity) {
		movements.push({ id: `${item.id}-damage`, logisticsItemId: item.id, campId: item.campId, type: "DAMAGE", quantity: item.damageQuantity, reason: "Pemeriksaan kualitas stok berkala", createdById: item.createdById, distributionId: null, createdAt: dateDaysAgo(18) });
	}
	if (item.lossQuantity) {
		movements.push({ id: `${item.id}-loss`, logisticsItemId: item.id, campId: item.campId, type: "LOSS", quantity: item.lossQuantity, reason: "Selisih inventaris saat stock opname", createdById: item.createdById, distributionId: null, createdAt: dateDaysAgo(17) });
	}
}

movements.push(
	{ id: "seed-movement-reserved-candi-taman", logisticsItemId: "seed-item-candi-rice", campId: "seed-camp-candi", type: "RESERVATION", quantity: 80, reason: "Reservasi untuk Posko Taman", createdById: headFor("seed-camp-candi", "LOGISTICS").id, distributionId: "seed-distribution-reserved-candi-taman-rice", createdAt: dateDaysAgo(5, 1) },
	{ id: "seed-movement-out-gor-taman", logisticsItemId: "seed-item-gor-water", campId: "seed-camp-gor-sidoarjo", type: "DISTRIBUTION_OUT", quantity: 40, reason: "Pengiriman air ke Posko Taman", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, distributionId: "seed-distribution-shipped-gor-taman-water", createdAt: dateDaysAgo(2) },
	{ id: "seed-movement-out-candi-waru", logisticsItemId: "seed-item-candi-hygiene", campId: "seed-camp-candi", type: "DISTRIBUTION_OUT", quantity: 30, reason: "Pengiriman hygiene kit ke Posko Waru", createdById: headFor("seed-camp-candi", "LOGISTICS").id, distributionId: "seed-distribution-received-candi-waru-hygiene", createdAt: dateDaysAgo(6) },
	{ id: "seed-movement-in-taman-gor", logisticsItemId: "seed-item-taman-water", campId: "seed-camp-taman", type: "DISTRIBUTION_IN", quantity: 40, reason: "Penerimaan air dari Posko GOR Sidoarjo", createdById: headFor("seed-camp-taman", "LOGISTICS").id, distributionId: "seed-distribution-shipped-gor-taman-water", createdAt: dateDaysAgo(2, 4) },
	{ id: "seed-movement-in-waru-candi", logisticsItemId: "seed-item-waru-hygiene", campId: "seed-camp-waru", type: "DISTRIBUTION_IN", quantity: 30, reason: "Penerimaan hygiene kit dari Posko Candi", createdById: headFor("seed-camp-waru", "LOGISTICS").id, distributionId: "seed-distribution-received-candi-waru-hygiene", createdAt: dateDaysAgo(4) },
	{ id: "seed-movement-reserve-taman-candi", logisticsItemId: "seed-item-taman-rice", campId: "seed-camp-taman", type: "RESERVATION", quantity: 20, reason: "Reservasi awal untuk Posko Candi", createdById: headFor("seed-camp-taman", "LOGISTICS").id, distributionId: "seed-distribution-cancelled-taman-candi-rice", createdAt: dateDaysAgo(9, 1) },
	{ id: "seed-movement-release-taman-candi", logisticsItemId: "seed-item-taman-rice", campId: "seed-camp-taman", type: "RESERVATION_RELEASE", quantity: 20, reason: "Reservasi dilepas karena pasokan lokal tersedia", createdById: headFor("seed-camp-taman", "LOGISTICS").id, distributionId: "seed-distribution-cancelled-taman-candi-rice", createdAt: dateDaysAgo(8, 20) },
);

const auditLogs = [
	{ id: "seed-audit-system-created", userId: userData.admin.id, action: "SEED", entity: "System", entityId: null, details: { message: "Fixture operasional dibuat", version: "complex-2026-09" }, createdAt: dateDaysAgo(30) },
	{ id: "seed-audit-user-admin", userId: userData.admin.id, action: "CREATE", entity: "User", entityId: userData.admin.id, details: { name: userData.admin.name, role: userData.admin.role }, createdAt: dateDaysAgo(29) },
	...camps.map((camp, index) => ({ id: `seed-audit-camp-${camp.key}`, userId: userData.admin.id, action: "CREATE", entity: "Camp", entityId: camp.id, details: { name: camp.name, status: camp.status }, createdAt: dateDaysAgo(28 - index) })),
	...camps.flatMap((camp, index) => [
		{ id: `seed-audit-manager-${camp.key}`, userId: userData.admin.id, action: "ASSIGN_MANAGER", entity: "Camp", entityId: camp.id, details: { managerId: managerFor(camp.id).id }, createdAt: dateDaysAgo(22 - index) },
		...divisions.map((division, divisionIndex) => ({ id: `seed-audit-head-${camp.key}-${division.toLowerCase()}`, userId: userData.admin.id, action: "ASSIGN_DIVISION_HEAD", entity: "CampDivisionHead", entityId: `${camp.id}:${division}`, details: { division, userId: headFor(camp.id, division).id }, createdAt: dateDaysAgo(20 - index - divisionIndex) })),
	]),
	{ id: "seed-audit-stock-receipt", userId: headFor("seed-camp-candi", "LOGISTICS").id, action: "RECEIPT", entity: "InventoryMovement", entityId: "seed-item-candi-rice-receipt", details: { itemName: "Beras", quantity: 520, unit: "kg" }, createdAt: dateDaysAgo(30) },
	{ id: "seed-audit-distribution-received", userId: headFor("seed-camp-waru", "LOGISTICS").id, action: "RECEIVE", entity: "Distribution", entityId: "seed-distribution-received-candi-waru-hygiene", details: { quantity: 30, itemName: "Hygiene Kit" }, createdAt: dateDaysAgo(4) },
	{ id: "seed-audit-facility-damaged", userId: headFor("seed-camp-gor-sidoarjo", "SHELTER").id, action: "UPDATE", entity: "FacilityReport", entityId: "seed-facility-gor-sidoarjo-water", details: { status: "DAMAGED" }, createdAt: dateDaysAgo(3) },
];

async function upsertCamp(camp: CampSeed) {
	return prisma.camp.upsert({
		where: { id: camp.id },
		update: { name: camp.name, address: camp.address, latitude: camp.latitude, longitude: camp.longitude, maxCapacity: camp.maxCapacity, currentOccupants: 0, status: camp.status, managerId: null, createdAt: dateDaysAgo(30) },
		create: { id: camp.id, name: camp.name, address: camp.address, latitude: camp.latitude, longitude: camp.longitude, maxCapacity: camp.maxCapacity, currentOccupants: 0, status: camp.status, createdAt: dateDaysAgo(30) },
	});
}

async function upsertUser(user: UserSeed, passwordHash: string) {
	const seedId = user.id;
	const saved = await prisma.user.upsert({
		where: { email: user.email },
		update: { name: user.name, password: passwordHash, role: user.role, division: user.division, campId: user.campId },
		create: { id: user.id, name: user.name, email: user.email, password: passwordHash, role: user.role, division: user.division, campId: user.campId, createdAt: dateDaysAgo(29) },
	});
	user.id = saved.id;
	userIdMap.set(seedId, saved.id);
	return saved;
}

async function upsertLogisticsItem(item: LogisticsSeed) {
	return prisma.logisticsItem.upsert({
		where: { id: item.id },
		update: { campId: item.campId, itemName: item.itemName, quantity: item.quantity, reservedQuantity: item.reservedQuantity, damagedQuantity: item.damagedQuantity, minimumQuantity: item.minimumQuantity, unit: item.unit, status: item.status, notes: item.notes, createdAt: dateDaysAgo(30) },
		create: { id: item.id, campId: item.campId, itemName: item.itemName, quantity: item.quantity, reservedQuantity: item.reservedQuantity, damagedQuantity: item.damagedQuantity, minimumQuantity: item.minimumQuantity, unit: item.unit, status: item.status, notes: item.notes, createdAt: dateDaysAgo(30) },
	});
}

async function upsertFacility(facility: FacilitySeed) {
	return prisma.facilityReport.upsert({
		where: { id: facility.id },
		update: { campId: facility.campId, facilityName: facility.facilityName, status: facility.status, description: facility.description, createdAt: facility.createdAt },
		create: { id: facility.id, campId: facility.campId, facilityName: facility.facilityName, status: facility.status, description: facility.description, createdAt: facility.createdAt },
	});
}

async function upsertEvacuee(evacuee: EvacueeSeed) {
	return prisma.evacueeRecord.upsert({
		where: { id: evacuee.id },
		update: { campId: evacuee.campId, name: evacuee.name, totalFamily: evacuee.totalFamily, hasSpecialNeeds: evacuee.hasSpecialNeeds, notes: evacuee.notes, arrivedAt: evacuee.arrivedAt, departedAt: evacuee.departedAt, createdAt: evacuee.arrivedAt },
		create: { id: evacuee.id, campId: evacuee.campId, name: evacuee.name, totalFamily: evacuee.totalFamily, hasSpecialNeeds: evacuee.hasSpecialNeeds, notes: evacuee.notes, arrivedAt: evacuee.arrivedAt, departedAt: evacuee.departedAt, createdAt: evacuee.arrivedAt },
	});
}

async function upsertRequest(request: RequestSeed) {
	return prisma.logisticsRequest.upsert({
		where: { id: request.id },
		update: { sourceCampId: request.sourceCampId, destinationCampId: request.destinationCampId, createdById: request.createdById, reviewedById: request.reviewedById, itemName: request.itemName, quantity: request.quantity, unit: request.unit, notes: request.notes, rejectionReason: request.rejectionReason, status: request.status, createdAt: request.createdAt },
		create: { id: request.id, sourceCampId: request.sourceCampId, destinationCampId: request.destinationCampId, createdById: request.createdById, reviewedById: request.reviewedById, itemName: request.itemName, quantity: request.quantity, unit: request.unit, notes: request.notes, rejectionReason: request.rejectionReason, status: request.status, createdAt: request.createdAt },
	});
}

async function upsertDistribution(distribution: DistributionSeed) {
	return prisma.distribution.upsert({
		where: { id: distribution.id },
		update: { requestId: distribution.requestId, sourceCampId: distribution.sourceCampId, destinationCampId: distribution.destinationCampId, sourceItemId: distribution.sourceItemId, createdById: distribution.createdById, itemName: distribution.itemName, quantity: distribution.quantity, unit: distribution.unit, notes: distribution.notes, status: distribution.status, shippedAt: distribution.shippedAt, receivedAt: distribution.receivedAt, createdAt: distribution.createdAt },
		create: { id: distribution.id, requestId: distribution.requestId, sourceCampId: distribution.sourceCampId, destinationCampId: distribution.destinationCampId, sourceItemId: distribution.sourceItemId, createdById: distribution.createdById, itemName: distribution.itemName, quantity: distribution.quantity, unit: distribution.unit, notes: distribution.notes, status: distribution.status, shippedAt: distribution.shippedAt, receivedAt: distribution.receivedAt, createdAt: distribution.createdAt },
	});
}

async function upsertMovement(movement: MovementSeed) {
	return prisma.inventoryMovement.upsert({
		where: { id: movement.id },
		update: { logisticsItemId: movement.logisticsItemId, campId: movement.campId, type: movement.type, quantity: movement.quantity, reason: movement.reason, createdById: movement.createdById, distributionId: movement.distributionId, createdAt: movement.createdAt },
		create: { id: movement.id, logisticsItemId: movement.logisticsItemId, campId: movement.campId, type: movement.type, quantity: movement.quantity, reason: movement.reason, createdById: movement.createdById, distributionId: movement.distributionId, createdAt: movement.createdAt },
	});
}

async function validateSeed() {
	const campRows = await prisma.camp.findMany({ where: { id: { in: camps.map((camp) => camp.id) } } });
	if (campRows.length !== camps.length) throw new Error("SEED_VALIDATION_CAMP_COUNT");

	const managerRows = await prisma.camp.findMany({ where: { id: { in: camps.map((camp) => camp.id) } }, select: { id: true, managerId: true } });
	for (const camp of camps) {
		if (managerRows.find((row) => row.id === camp.id)?.managerId !== managerFor(camp.id).id) throw new Error(`SEED_VALIDATION_MANAGER_${camp.id}`);
	}

	const assignmentRows = await prisma.campDivisionHead.findMany({ where: { campId: { in: camps.map((camp) => camp.id) } } });
	if (assignmentRows.length < camps.length * divisions.length) throw new Error("SEED_VALIDATION_DIVISION_HEAD_COUNT");

	const evacueeRows = await prisma.evacueeRecord.findMany({ where: { id: { in: evacuees.map((evacuee) => evacuee.id) } }, select: { campId: true, totalFamily: true, departedAt: true } });
	for (const camp of camps) {
		const expectedOccupants = evacueeRows.filter((evacuee) => evacuee.campId === camp.id && !evacuee.departedAt).reduce((total, evacuee) => total + evacuee.totalFamily, 0);
		const actualOccupants = campRows.find((row) => row.id === camp.id)?.currentOccupants;
		if (expectedOccupants !== actualOccupants) throw new Error(`SEED_VALIDATION_OCCUPANCY_${camp.id}`);
		if (expectedOccupants > (campRows.find((row) => row.id === camp.id)?.maxCapacity || 0)) throw new Error(`SEED_VALIDATION_CAPACITY_${camp.id}`);
	}

	const itemRows = await prisma.logisticsItem.findMany({ where: { id: { in: logisticsItems.map((item) => item.id) } }, select: { id: true, campId: true, quantity: true, reservedQuantity: true } });
	if (itemRows.length !== logisticsItems.length) throw new Error("SEED_VALIDATION_ITEM_COUNT");
	if (itemRows.some((item) => item.quantity < 0 || item.reservedQuantity < 0 || item.reservedQuantity > item.quantity)) throw new Error("SEED_VALIDATION_ITEM_BALANCE");

	const movementRows = await prisma.inventoryMovement.findMany({ where: { id: { in: movements.map((movement) => movement.id) } }, select: { id: true, campId: true, logisticsItem: { select: { campId: true } } } });
	if (movementRows.length !== movements.length) throw new Error("SEED_VALIDATION_MOVEMENT_COUNT");
	if (movementRows.some((movement) => movement.campId !== movement.logisticsItem.campId)) throw new Error("SEED_VALIDATION_MOVEMENT_CAMP");

	const requestRows = await prisma.logisticsRequest.findMany({ where: { id: { in: requests.map((request) => request.id) } }, include: { distribution: true } });
	if (requestRows.length !== requests.length) throw new Error("SEED_VALIDATION_REQUEST_COUNT");
	for (const request of requestRows) {
		if (request.distribution && request.distribution.status !== request.status) throw new Error(`SEED_VALIDATION_REQUEST_STATUS_${request.id}`);
	}

	const distributionRows = await prisma.distribution.findMany({ where: { id: { in: distributions.map((distribution) => distribution.id) } } });
	if (distributionRows.length !== distributions.length) throw new Error("SEED_VALIDATION_DISTRIBUTION_COUNT");
	if (distributionRows.some((distribution) => distribution.sourceCampId === distribution.destinationCampId)) throw new Error("SEED_VALIDATION_DISTRIBUTION_ROUTE");
}

async function main() {
	console.log("Seeding complex operational fixture...");
	const passwordHash = await bcrypt.hash(password, 12);

	for (const camp of camps) await upsertCamp(camp);
	for (const user of userData.users) await upsertUser(user, passwordHash);
	const resolveUserId = (seedId: string) => userIdMap.get(seedId) ?? seedId;
	for (const item of logisticsItems) item.createdById = resolveUserId(item.createdById);
	for (const request of requests) {
		request.createdById = resolveUserId(request.createdById);
		request.reviewedById = request.reviewedById ? resolveUserId(request.reviewedById) : null;
	}
	for (const distribution of distributions) distribution.createdById = resolveUserId(distribution.createdById);
	for (const movement of movements) movement.createdById = resolveUserId(movement.createdById);
	for (const camp of camps) {
		await prisma.camp.update({ where: { id: camp.id }, data: { managerId: managerFor(camp.id).id } });
		for (const division of divisions) {
			const head = headFor(camp.id, division);
			await prisma.campDivisionHead.upsert({ where: { campId_division: { campId: camp.id, division } }, update: { userId: head.id, createdAt: dateDaysAgo(25) }, create: { id: `seed-assignment-${camp.key}-${division.toLowerCase()}`, campId: camp.id, division, userId: head.id, createdAt: dateDaysAgo(25) } });
		}
	}
	for (const item of logisticsItems) await upsertLogisticsItem(item);
	for (const facility of facilities) await upsertFacility(facility);
	for (const evacuee of evacuees) await upsertEvacuee(evacuee);
	for (const request of requests) await upsertRequest(request);
	for (const distribution of distributions) await upsertDistribution(distribution);
	for (const movement of movements) await upsertMovement(movement);
	for (const camp of camps) {
		const currentOccupants = evacuees.filter((evacuee) => evacuee.campId === camp.id && !evacuee.departedAt).reduce((total, evacuee) => total + evacuee.totalFamily, 0);
		await prisma.camp.update({ where: { id: camp.id }, data: { currentOccupants } });
	}
	for (const log of auditLogs) {
		const userId = userIdMap.get(log.userId) ?? log.userId;
		await prisma.auditLog.upsert({ where: { id: log.id }, update: { userId, action: log.action, entity: log.entity, entityId: log.entityId, details: JSON.stringify(log.details), createdAt: log.createdAt }, create: { id: log.id, userId, action: log.action, entity: log.entity, entityId: log.entityId, details: JSON.stringify(log.details), createdAt: log.createdAt } });
	}
	await validateSeed();

	console.log(`Seed completed: ${camps.length} camps, ${userData.users.length} users, ${logisticsItems.length} logistics items, ${facilities.length} facilities, ${evacuees.length} evacuee records, ${requests.length} requests, ${distributions.length} distributions, ${movements.length} inventory movements, ${auditLogs.length} audit logs.`);
	console.log(`Development password: ${password}`);
	console.log(`Scenario date: ${seedAsOf.toISOString()}`);
}

main()
	.catch((error) => {
		console.error("Seed failed:", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
