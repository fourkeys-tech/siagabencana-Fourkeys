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

// Guard production: mencegah reset user & overwrite data pada environment non-dev/staging.
const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
if (isProd && process.env.SEED_ALLOW_PROD !== "1") {
	throw new Error("ABORT: Seeding dinonaktifkan di environment production. Set SEED_ALLOW_PROD=1 untuk override sengaja.");
}

const password = process.env.SEED_PASSWORD || "password123";
if (!password || password.length < 8) {
	throw new Error("SEED_PASSWORD wajib diisi minimal 8 karakter.");
}
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
type MovementTypeValue = "RECEIPT" | "DAMAGE" | "LOSS" | "RESTORE" | "DISPOSE" | "RESERVATION" | "RESERVATION_RELEASE" | "DISTRIBUTION_OUT" | "DISTRIBUTION_IN";

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

type SeedUnitMetadata = {
	baseUnit: string;
	unitDimension: "COUNT" | "MASS" | "VOLUME";
	conversionFactor: number;
	conversionStatus: "CONFIGURED" | "NEEDS_REVIEW";
	conversionNote: string;
};

function unitMetadata(unit: string): SeedUnitMetadata {
	const normalized = unit.trim().toLowerCase();
	if (normalized === "kg" || normalized === "kilogram") return { baseUnit: "g", unitDimension: "MASS", conversionFactor: 1000, conversionStatus: "CONFIGURED", conversionNote: "Konversi standar 1 kg = 1000 g." };
	if (normalized === "g" || normalized === "gram" || normalized === "gr") return { baseUnit: "g", unitDimension: "MASS", conversionFactor: 1, conversionStatus: "CONFIGURED", conversionNote: "Unit dasar massa." };
	if (normalized === "l" || normalized === "liter" || normalized === "ltr") return { baseUnit: "ml", unitDimension: "VOLUME", conversionFactor: 1000, conversionStatus: "CONFIGURED", conversionNote: "Konversi standar 1 l = 1000 ml." };
	if (normalized === "ml" || normalized === "mililiter" || normalized === "milliliter") return { baseUnit: "ml", unitDimension: "VOLUME", conversionFactor: 1, conversionStatus: "CONFIGURED", conversionNote: "Unit dasar volume." };
	if (normalized === "unit") return { baseUnit: "unit", unitDimension: "COUNT", conversionFactor: 1, conversionStatus: "CONFIGURED", conversionNote: "Unit dasar peralatan." };
	if (normalized === "pcs" || normalized === "pc" || normalized === "buah") return { baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 1, conversionStatus: "CONFIGURED", conversionNote: "Unit dasar barang hitung." };
	return { baseUnit: normalized, unitDimension: "COUNT", conversionFactor: 1, conversionStatus: "NEEDS_REVIEW", conversionNote: "Isi kemasan belum didefinisikan; konversi lintas unit diblokir." };
}

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
		name: "Posko Evakuasi Kantor Kecamatan Taman",
		address: "Kantor Kecamatan Taman, Sidoarjo",
		latitude: -7.3524,
		longitude: 112.6942,
		maxCapacity: 300,
		status: "ACTIVE",
	},
	{
		id: "seed-camp-waru",
		key: "waru",
		name: "Posko Evakuasi Balai RW Waru",
		address: "Balai RW 03 Waru, Sidoarjo",
		latitude: -7.3541,
		longitude: 112.7231,
		maxCapacity: 120,
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

interface PersonProfile {
	name: string;
	email: string;
}

interface CampStaffProfiles {
	manager: PersonProfile;
	divisions: Record<
		DivisionValue,
		{
			head: PersonProfile;
			officers: [PersonProfile, PersonProfile];
		}
	>;
}

// Profil staf posko dengan nama manusia asli Indonesia (tanpa format nama cabang / posko)
const staffProfilesByCamp: Record<string, CampStaffProfiles> = {
	"seed-camp-candi": {
		manager: { name: "Ahmad Fauzi", email: "ahmad.fauzi@siagabencana.local" },
		divisions: {
			LOGISTICS: {
				head: { name: "Siti Nurhaliza", email: "siti.nurhaliza@siagabencana.local" },
				officers: [
					{ name: "Rian Hidayat", email: "rian.hidayat@siagabencana.local" },
					{ name: "Eko Prasetyo", email: "eko.prasetyo@siagabencana.local" },
				],
			},
			SHELTER: {
				head: { name: "Hendra Wijaya", email: "hendra.wijaya@siagabencana.local" },
				officers: [
					{ name: "Nurul Hidayati", email: "nurul.hidayati@siagabencana.local" },
					{ name: "Bambang Kurniawan", email: "bambang.kurniawan@siagabencana.local" },
				],
			},
			DATA_REGISTRATION: {
				head: { name: "Dewi Lestari", email: "dewi.lestari@siagabencana.local" },
				officers: [
					{ name: "Indah Permata", email: "indah.permata@siagabencana.local" },
					{ name: "Rizky Ramadhan", email: "rizky.ramadhan@siagabencana.local" },
				],
			},
		},
	},
	"seed-camp-gor-sidoarjo": {
		manager: { name: "Joko Susilo", email: "joko.susilo@siagabencana.local" },
		divisions: {
			LOGISTICS: {
				head: { name: "Aris Munandar", email: "aris.munandar@siagabencana.local" },
				officers: [
					{ name: "Fajar Nugroho", email: "fajar.nugroho@siagabencana.local" },
					{ name: "Dian Anggraini", email: "dian.anggraini@siagabencana.local" },
				],
			},
			SHELTER: {
				head: { name: "Tri Wahyuni", email: "tri.wahyuni@siagabencana.local" },
				officers: [
					{ name: "Wahyu Setiawan", email: "wahyu.setiawan@siagabencana.local" },
					{ name: "Sri Rejeki", email: "sri.rejeki@siagabencana.local" },
				],
			},
			DATA_REGISTRATION: {
				head: { name: "Agus Pratama", email: "agus.pratama@siagabencana.local" },
				officers: [
					{ name: "Dimas Saputra", email: "dimas.saputra@siagabencana.local" },
					{ name: "Ratna Sari", email: "ratna.sari@siagabencana.local" },
				],
			},
		},
	},
	"seed-camp-taman": {
		manager: { name: "Mulyadi", email: "mulyadi@siagabencana.local" },
		divisions: {
			LOGISTICS: {
				head: { name: "Fitri Handayani", email: "fitri.handayani@siagabencana.local" },
				officers: [
					{ name: "Surya Pratama", email: "surya.pratama@siagabencana.local" },
					{ name: "Anisa Rahmawati", email: "anisa.rahmawati@siagabencana.local" },
				],
			},
			SHELTER: {
				head: { name: "Bagus Wicaksono", email: "bagus.wicaksono@siagabencana.local" },
				officers: [
					{ name: "Danang Kusuma", email: "danang.kusuma@siagabencana.local" },
					{ name: "Putri Utami", email: "putri.utami@siagabencana.local" },
				],
			},
			DATA_REGISTRATION: {
				head: { name: "Maya Safitri", email: "maya.safitri@siagabencana.local" },
				officers: [
					{ name: "Bayu Aji", email: "bayu.aji@siagabencana.local" },
					{ name: "Nadia Faradila", email: "nadia.faradila@siagabencana.local" },
				],
			},
		},
	},
	"seed-camp-waru": {
		manager: { name: "Iskandar Zulkarnaen", email: "iskandar.zulkarnaen@siagabencana.local" },
		divisions: {
			LOGISTICS: {
				head: { name: "Lukman Hakim", email: "lukman.hakim@siagabencana.local" },
				officers: [
					{ name: "Ade Kurnia", email: "ade.kurnia@siagabencana.local" },
					{ name: "Mega Puspita", email: "mega.puspita@siagabencana.local" },
				],
			},
			SHELTER: {
				head: { name: "Rina Marlina", email: "rina.marlina@siagabencana.local" },
				officers: [
					{ name: "Taufik Rahman", email: "taufik.rahman@siagabencana.local" },
					{ name: "Yulia Citra", email: "yulia.citra@siagabencana.local" },
				],
			},
			DATA_REGISTRATION: {
				head: { name: "Dodi Firmansyah", email: "dodi.firmansyah@siagabencana.local" },
				officers: [
					{ name: "Gita Savitri", email: "gita.savitri@siagabencana.local" },
					{ name: "Hadi Purnomo", email: "hadi.purnomo@siagabencana.local" },
				],
			},
		},
	},
	"seed-camp-gedangan": {
		manager: { name: "Sugeng Riyadi", email: "sugeng.riyadi@siagabencana.local" },
		divisions: {
			LOGISTICS: {
				head: { name: "Wawan Hermawan", email: "wawan.hermawan@siagabencana.local" },
				officers: [
					{ name: "Irfan Maulana", email: "irfan.maulana@siagabencana.local" },
					{ name: "Lilis Suryani", email: "lilis.suryani@siagabencana.local" },
				],
			},
			SHELTER: {
				head: { name: "Endang Sulastri", email: "endang.sulastri@siagabencana.local" },
				officers: [
					{ name: "Yusuf Efendi", email: "yusuf.efendi@siagabencana.local" },
					{ name: "Titin Sumarni", email: "titin.sumarni@siagabencana.local" },
				],
			},
			DATA_REGISTRATION: {
				head: { name: "Kurnia Sandi", email: "kurnia.sandi@siagabencana.local" },
				officers: [
					{ name: "Agil Saputro", email: "agil.saputro@siagabencana.local" },
					{ name: "Novi Indriani", email: "novi.indriani@siagabencana.local" },
				],
			},
		},
	},
};

function createUsers() {
	const admin: UserSeed = {
		id: "seed-user-admin",
		name: "Budi Santoso",
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
		const profile = staffProfilesByCamp[camp.id];
		if (!profile) continue;

		const manager: UserSeed = {
			id: `seed-user-manager-${camp.key}`,
			name: profile.manager.name,
			email: profile.manager.email,
			role: "MANAGER",
			division: null,
			campId: camp.id,
		};
		users.push(manager);
		managers.set(camp.id, manager);

		for (const division of divisions) {
			const divProfile = profile.divisions[division];
			const divisionKey = division.toLowerCase();

			const head: UserSeed = {
				id: `seed-user-head-${camp.key}-${divisionKey}`,
				name: divProfile.head.name,
				email: divProfile.head.email,
				role: "DIVISION_HEAD",
				division,
				campId: camp.id,
			};
			users.push(head);
			heads.set(`${camp.id}:${division}`, head);

			divProfile.officers.forEach((offProfile, idx) => {
				const sequence = idx + 1;
				const officer: UserSeed = {
					id: `seed-user-field-${camp.key}-${divisionKey}-${sequence}`,
					name: offProfile.name,
					email: offProfile.email,
					role: "FIELD_OFFICER",
					division,
					campId: camp.id,
				};
				users.push(officer);
				officers.set(`${camp.id}:${division}:${sequence}`, officer);
			});
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

// Inventaris logistik realistis standar penanggulangan darurat bencana (pangan, hunian, sanitasi, medis, peralatan)
const logisticsItems: LogisticsSeed[] = [
	// Posko Balai Desa Candi
	{ id: "seed-item-candi-rice", campId: "seed-camp-candi", itemName: "Beras Premium", quantity: 850, reservedQuantity: 80, damagedQuantity: 0, minimumQuantity: 200, unit: "kg", status: "SUFFICIENT", notes: "Stok beras untuk operasional dapur umum utama.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-water", campId: "seed-camp-candi", itemName: "Air Mineral 600ml", quantity: 240, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 100, unit: "dus", status: "SUFFICIENT", notes: "Pasokan air minum kemasan harian untuk pengungsi.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-noodle", campId: "seed-camp-candi", itemName: "Mie Instan Dus", quantity: 120, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 50, unit: "dus", status: "SUFFICIENT", notes: "Stok cadangan makanan darurat dapur umum.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-baby-food", campId: "seed-camp-candi", itemName: "Biskuit & Makanan Bayi", quantity: 45, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "dus", status: "SUFFICIENT", notes: "Nutrisi dan bubur instan untuk balita.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-hygiene", campId: "seed-camp-candi", itemName: "Paket Hygiene Kit Keluarga", quantity: 65, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "paket", status: "SUFFICIENT", notes: "Paket sabun, pasta gigi, handuk, dan detergen. Sebagian dikirim ke Posko Waru.", createdById: headFor("seed-camp-candi", "LOGISTICS").id, outboundQuantity: 30 },
	{ id: "seed-item-candi-medicine", campId: "seed-camp-candi", itemName: "Paket P3K & Obat Darurat", quantity: 18, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 35, unit: "box", status: "LOW", notes: "Perlu restock paracetamol, perban, dan antiseptik dari Dinas Kesehatan.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-blanket", campId: "seed-camp-candi", itemName: "Selimut Hangat Dewasa", quantity: 8, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 30, unit: "pcs", status: "CRITICAL", notes: "Stok menipis drastis karena lonjakan pengungsi baru di tenda keluarga.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-tarpaulin", campId: "seed-camp-candi", itemName: "Terpal Plastik HDPE 4x6m", quantity: 32, reservedQuantity: 0, damagedQuantity: 6, minimumQuantity: 15, unit: "pcs", status: "SPOILED_OR_DAMAGED", notes: "Enam lembar terpal robek saat terpaan angin kencang di area tenda cadangan.", createdById: headFor("seed-camp-candi", "LOGISTICS").id, damageQuantity: 6 },
	{ id: "seed-item-candi-tent", campId: "seed-camp-candi", itemName: "Tenda Pengungsi Keluarga 4x4m", quantity: 12, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 5, unit: "unit", status: "SUFFICIENT", notes: "Tenda pleton modular siap didirikan bila ada arus susulan.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-diapers", campId: "seed-camp-candi", itemName: "Popok Bayi (Pampers Balita)", quantity: 15, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 25, unit: "box", status: "LOW", notes: "Kebutuhan meningkat untuk balita di blok pengungsian barat.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-pads", campId: "seed-camp-candi", itemName: "Pembalut Wanita", quantity: 50, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "pcs", status: "SUFFICIENT", notes: "Distribusi berkala bersama pembagian perlengkapan sanitasi.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },
	{ id: "seed-item-candi-generator", campId: "seed-camp-candi", itemName: "Genset Listrik Portable 3500W", quantity: 4, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 2, unit: "unit", status: "SUFFICIENT", notes: "Dua unit menyala untuk tenda medis, dua unit stand-by.", createdById: headFor("seed-camp-candi", "LOGISTICS").id },

	// Posko GOR Sidoarjo
	{ id: "seed-item-gor-rice", campId: "seed-camp-gor-sidoarjo", itemName: "Beras Premium", quantity: 650, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 250, unit: "kg", status: "SUFFICIENT", notes: "Stok utama dapur umum besar aula GOR Sidoarjo.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id },
	{ id: "seed-item-gor-water", campId: "seed-camp-gor-sidoarjo", itemName: "Air Mineral 600ml", quantity: 45, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 120, unit: "dus", status: "LOW", notes: "Stok menipis setelah penyaluran bantuan ke Posko Taman.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, outboundQuantity: 40 },
	{ id: "seed-item-gor-ready-meal", campId: "seed-camp-gor-sidoarjo", itemName: "Makanan Siap Saji (Ransum Darurat)", quantity: 280, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 100, unit: "dus", status: "SUFFICIENT", notes: "Ransum darurat siap santap untuk logistik cepat.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id },
	{ id: "seed-item-gor-noodle", campId: "seed-camp-gor-sidoarjo", itemName: "Mie Instan Dus", quantity: 210, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 80, unit: "dus", status: "SUFFICIENT", notes: "Cadangan pangan darurat dapur umum.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id },
	{ id: "seed-item-gor-hygiene", campId: "seed-camp-gor-sidoarjo", itemName: "Paket Hygiene Kit Keluarga", quantity: 0, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 40, unit: "paket", status: "CRITICAL", notes: "Stok habis total, menunggu pengiriman bantuan logistik BPBD.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, lossQuantity: 15 },
	{ id: "seed-item-gor-generator", campId: "seed-camp-gor-sidoarjo", itemName: "Genset Listrik Portable 3500W", quantity: 6, reservedQuantity: 0, damagedQuantity: 2, minimumQuantity: 3, unit: "unit", status: "SPOILED_OR_DAMAGED", notes: "Dua unit mengalami kerusakan dinamo dan sedang diperbaiki teknisi.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, damageQuantity: 2 },
	{ id: "seed-item-gor-blanket", campId: "seed-camp-gor-sidoarjo", itemName: "Selimut Hangat Dewasa", quantity: 180, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 80, unit: "pcs", status: "SUFFICIENT", notes: "Tersalurkan ke tribun dan aula indoor.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id },
	{ id: "seed-item-gor-mattress", campId: "seed-camp-gor-sidoarjo", itemName: "Matras Lipat Spons", quantity: 220, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 100, unit: "pcs", status: "SUFFICIENT", notes: "Alas tidur pengungsi di lantai aula olahraga.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id },
	{ id: "seed-item-gor-medicine", campId: "seed-camp-gor-sidoarjo", itemName: "Paket P3K & Obat Darurat", quantity: 12, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 30, unit: "box", status: "LOW", notes: "Perlu tambahan obat flu, salep kulit, dan obat lambung.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id },
	{ id: "seed-item-gor-mask", campId: "seed-camp-gor-sidoarjo", itemName: "Masker Medis 3-Ply", quantity: 80, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 30, unit: "box", status: "SUFFICIENT", notes: "Pencegahan ISPA di area pengungsian tertutup.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id },
	{ id: "seed-item-gor-diapers", campId: "seed-camp-gor-sidoarjo", itemName: "Popok Bayi (Pampers Balita)", quantity: 35, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 25, unit: "box", status: "SUFFICIENT", notes: "Stok balita memadai untuk 5 hari ke depan.", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id },

	// Posko Kantor Kecamatan Taman
	{ id: "seed-item-taman-rice", campId: "seed-camp-taman", itemName: "Beras Premium", quantity: 95, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 120, unit: "kg", status: "LOW", notes: "Permintaan transfer 80 kg dari Posko Candi sedang diproses.", createdById: headFor("seed-camp-taman", "LOGISTICS").id },
	{ id: "seed-item-taman-water", campId: "seed-camp-taman", itemName: "Air Mineral 600ml", quantity: 58, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 40, unit: "dus", status: "SUFFICIENT", notes: "Tambahan pasokan telah diterima dari Posko GOR Sidoarjo.", createdById: headFor("seed-camp-taman", "LOGISTICS").id, inboundQuantity: 40 },
	{ id: "seed-item-taman-ready-meal", campId: "seed-camp-taman", itemName: "Makanan Siap Saji (Ransum Darurat)", quantity: 190, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 60, unit: "dus", status: "SUFFICIENT", notes: "Stok ransum cukup untuk 4 hari ke depan.", createdById: headFor("seed-camp-taman", "LOGISTICS").id },
	{ id: "seed-item-taman-noodle", campId: "seed-camp-taman", itemName: "Mie Instan Dus", quantity: 85, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 40, unit: "dus", status: "SUFFICIENT", notes: "Kebutuhan harian dapur umum Taman.", createdById: headFor("seed-camp-taman", "LOGISTICS").id },
	{ id: "seed-item-taman-blanket", campId: "seed-camp-taman", itemName: "Selimut Hangat Dewasa", quantity: 22, reservedQuantity: 0, damagedQuantity: 4, minimumQuantity: 20, unit: "pcs", status: "SPOILED_OR_DAMAGED", notes: "Empat lembar selimut basah terkena rembesan air saat hujan lebat.", createdById: headFor("seed-camp-taman", "LOGISTICS").id, damageQuantity: 4 },
	{ id: "seed-item-taman-hygiene", campId: "seed-camp-taman", itemName: "Paket Hygiene Kit Keluarga", quantity: 14, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 25, unit: "paket", status: "LOW", notes: "Jumlah paket tersisa sedikit, butuh penambahan dari gudang sentral.", createdById: headFor("seed-camp-taman", "LOGISTICS").id },
	{ id: "seed-item-taman-baby-food", campId: "seed-camp-taman", itemName: "Biskuit & Makanan Bayi", quantity: 8, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 15, unit: "dus", status: "LOW", notes: "Stok makanan bayi menipis karena peningkatan balita.", createdById: headFor("seed-camp-taman", "LOGISTICS").id },
	{ id: "seed-item-taman-tarpaulin", campId: "seed-camp-taman", itemName: "Terpal Plastik HDPE 4x6m", quantity: 18, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 10, unit: "pcs", status: "SUFFICIENT", notes: "Untuk kanopi darurat posko depan.", createdById: headFor("seed-camp-taman", "LOGISTICS").id },
	{ id: "seed-item-taman-medicine", campId: "seed-camp-taman", itemName: "Paket P3K & Obat Darurat", quantity: 6, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "box", status: "CRITICAL", notes: "Stok obat-obatan esensial hampir kosong.", createdById: headFor("seed-camp-taman", "LOGISTICS").id },

	// Posko Balai RW Waru
	{ id: "seed-item-waru-rice", campId: "seed-camp-waru", itemName: "Beras Premium", quantity: 140, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 50, unit: "kg", status: "SUFFICIENT", notes: "Stok mencukupi untuk kebutuhan warga pengungsi RW Waru.", createdById: headFor("seed-camp-waru", "LOGISTICS").id },
	{ id: "seed-item-waru-water", campId: "seed-camp-waru", itemName: "Air Mineral 600ml", quantity: 28, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 45, unit: "dus", status: "LOW", notes: "Konsumsi tinggi akibat suhu udara panas.", createdById: headFor("seed-camp-waru", "LOGISTICS").id },
	{ id: "seed-item-waru-noodle", campId: "seed-camp-waru", itemName: "Mie Instan Dus", quantity: 65, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 30, unit: "dus", status: "SUFFICIENT", notes: "Stok dapur umum balai RW.", createdById: headFor("seed-camp-waru", "LOGISTICS").id },
	{ id: "seed-item-waru-hygiene", campId: "seed-camp-waru", itemName: "Paket Hygiene Kit Keluarga", quantity: 48, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 25, unit: "paket", status: "SUFFICIENT", notes: "Bantuan telah diterima dari Posko Candi dan siap dibagikan.", createdById: headFor("seed-camp-waru", "LOGISTICS").id, inboundQuantity: 30 },
	{ id: "seed-item-waru-medicine", campId: "seed-camp-waru", itemName: "Paket P3K & Obat Darurat", quantity: 26, reservedQuantity: 0, damagedQuantity: 2, minimumQuantity: 15, unit: "box", status: "SPOILED_OR_DAMAGED", notes: "Dua box obat rusak kemasannya dan dipisahkan di ruang karantina.", createdById: headFor("seed-camp-waru", "LOGISTICS").id, damageQuantity: 2 },
	{ id: "seed-item-waru-lamp", campId: "seed-camp-waru", itemName: "Lampu Darurat Solar LED", quantity: 16, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "unit", status: "LOW", notes: "Penerangan lorong tenda masih kurang beberapa titik.", createdById: headFor("seed-camp-waru", "LOGISTICS").id },
	{ id: "seed-item-waru-blanket", campId: "seed-camp-waru", itemName: "Selimut Hangat Dewasa", quantity: 55, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 30, unit: "pcs", status: "SUFFICIENT", notes: "Cukup untuk seluruh keluarga di posko.", createdById: headFor("seed-camp-waru", "LOGISTICS").id },
	{ id: "seed-item-waru-diapers", campId: "seed-camp-waru", itemName: "Popok Bayi (Pampers Balita)", quantity: 22, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 15, unit: "box", status: "SUFFICIENT", notes: "Stok popok balita aman.", createdById: headFor("seed-camp-waru", "LOGISTICS").id },

	// Posko Gedangan Lama (CLOSED)
	{ id: "seed-item-gedangan-rice", campId: "seed-camp-gedangan", itemName: "Beras Premium", quantity: 150, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 40, unit: "kg", status: "SUFFICIENT", notes: "Sisa persediaan logistik sebelum penutupan posko.", createdById: headFor("seed-camp-gedangan", "LOGISTICS").id },
	{ id: "seed-item-gedangan-water", campId: "seed-camp-gedangan", itemName: "Air Mineral 600ml", quantity: 50, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 20, unit: "dus", status: "SUFFICIENT", notes: "Stok tersegel dalam gudang tertutup.", createdById: headFor("seed-camp-gedangan", "LOGISTICS").id },
	{ id: "seed-item-gedangan-blanket", campId: "seed-camp-gedangan", itemName: "Selimut Hangat Dewasa", quantity: 25, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 10, unit: "pcs", status: "SUFFICIENT", notes: "Akan dialihkan ke Posko Candi atau GOR.", createdById: headFor("seed-camp-gedangan", "LOGISTICS").id },
	{ id: "seed-item-gedangan-hygiene", campId: "seed-camp-gedangan", itemName: "Paket Hygiene Kit Keluarga", quantity: 30, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 10, unit: "paket", status: "SUFFICIENT", notes: "Disimpan dalam kontainer plastik tertutup rapat.", createdById: headFor("seed-camp-gedangan", "LOGISTICS").id },
	{ id: "seed-item-gedangan-medicine", campId: "seed-camp-gedangan", itemName: "Paket P3K & Obat Darurat", quantity: 10, reservedQuantity: 0, damagedQuantity: 1, minimumQuantity: 5, unit: "box", status: "SPOILED_OR_DAMAGED", notes: "Satu box melewati batas masa simpan obat salep.", createdById: headFor("seed-camp-gedangan", "LOGISTICS").id, damageQuantity: 1 },
	{ id: "seed-item-gedangan-tarpaulin", campId: "seed-camp-gedangan", itemName: "Terpal Plastik HDPE 4x6m", quantity: 15, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 5, unit: "pcs", status: "SUFFICIENT", notes: "Terpal cadangan disimpan rapi di gudang.", createdById: headFor("seed-camp-gedangan", "LOGISTICS").id },
];

const requests: RequestSeed[] = [
	{ id: "seed-request-pending-candi-gor-rice", sourceCampId: "seed-camp-candi", destinationCampId: "seed-camp-gor-sidoarjo", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, reviewedById: null, itemName: "Beras Premium", quantity: 50, unit: "kg", notes: "Permintaan tambahan untuk dapur umum akhir pekan.", rejectionReason: null, status: "PENDING", createdAt: dateDaysAgo(1, 4) },
	{ id: "seed-request-rejected-taman-waru-water", sourceCampId: "seed-camp-taman", destinationCampId: "seed-camp-waru", createdById: headFor("seed-camp-waru", "LOGISTICS").id, reviewedById: headFor("seed-camp-taman", "LOGISTICS").id, itemName: "Air Mineral 600ml", quantity: 30, unit: "dus", notes: "Permintaan untuk penambahan buffer air.", rejectionReason: "Stok sumber diprioritaskan untuk kebutuhan posko yang hampir penuh.", status: "REJECTED", createdAt: dateDaysAgo(4) },
	{ id: "seed-request-reserved-candi-taman-rice", sourceCampId: "seed-camp-candi", destinationCampId: "seed-camp-taman", createdById: headFor("seed-camp-taman", "LOGISTICS").id, reviewedById: headFor("seed-camp-candi", "LOGISTICS").id, itemName: "Beras Premium", quantity: 80, unit: "kg", notes: "Pengiriman beras untuk menjaga stok minimum Posko Taman.", rejectionReason: null, status: "RESERVED", createdAt: dateDaysAgo(5) },
	{ id: "seed-request-shipped-gor-taman-water", sourceCampId: "seed-camp-gor-sidoarjo", destinationCampId: "seed-camp-taman", createdById: headFor("seed-camp-taman", "LOGISTICS").id, reviewedById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, itemName: "Air Mineral 600ml", quantity: 40, unit: "dus", notes: "Pengiriman air untuk posko dengan okupansi tinggi.", rejectionReason: null, status: "SHIPPED", createdAt: dateDaysAgo(7) },
	{ id: "seed-request-received-candi-waru-hygiene", sourceCampId: "seed-camp-candi", destinationCampId: "seed-camp-waru", createdById: headFor("seed-camp-waru", "LOGISTICS").id, reviewedById: headFor("seed-camp-candi", "LOGISTICS").id, itemName: "Paket Hygiene Kit Keluarga", quantity: 30, unit: "paket", notes: "Bantuan hygiene kit untuk keluarga dengan anak kecil.", rejectionReason: null, status: "RECEIVED", createdAt: dateDaysAgo(11) },
	{ id: "seed-request-cancelled-taman-candi-rice", sourceCampId: "seed-camp-taman", destinationCampId: "seed-camp-candi", createdById: headFor("seed-camp-candi", "LOGISTICS").id, reviewedById: headFor("seed-camp-taman", "LOGISTICS").id, itemName: "Beras Premium", quantity: 20, unit: "kg", notes: "Permintaan dibatalkan setelah pasokan lokal tiba.", rejectionReason: null, status: "CANCELLED", createdAt: dateDaysAgo(9) },
];

const distributions: DistributionSeed[] = [
	{ id: "seed-distribution-reserved-candi-taman-rice", requestId: "seed-request-reserved-candi-taman-rice", sourceCampId: "seed-camp-candi", destinationCampId: "seed-camp-taman", sourceItemId: "seed-item-candi-rice", createdById: headFor("seed-camp-candi", "LOGISTICS").id, itemName: "Beras Premium", quantity: 80, unit: "kg", notes: "Pengiriman beras untuk menjaga stok minimum Posko Taman.", status: "RESERVED", createdAt: dateDaysAgo(5, 2), shippedAt: null, receivedAt: null },
	{ id: "seed-distribution-shipped-gor-taman-water", requestId: "seed-request-shipped-gor-taman-water", sourceCampId: "seed-camp-gor-sidoarjo", destinationCampId: "seed-camp-taman", sourceItemId: "seed-item-gor-water", createdById: headFor("seed-camp-gor-sidoarjo", "LOGISTICS").id, itemName: "Air Mineral 600ml", quantity: 40, unit: "dus", notes: "Pengiriman air untuk posko dengan okupansi tinggi.", status: "SHIPPED", createdAt: dateDaysAgo(7, 2), shippedAt: dateDaysAgo(2), receivedAt: null },
	{ id: "seed-distribution-received-candi-waru-hygiene", requestId: "seed-request-received-candi-waru-hygiene", sourceCampId: "seed-camp-candi", destinationCampId: "seed-camp-waru", sourceItemId: "seed-item-candi-hygiene", createdById: headFor("seed-camp-candi", "LOGISTICS").id, itemName: "Paket Hygiene Kit Keluarga", quantity: 30, unit: "paket", notes: "Bantuan hygiene kit untuk keluarga dengan anak kecil.", status: "RECEIVED", createdAt: dateDaysAgo(11, 2), shippedAt: dateDaysAgo(6), receivedAt: dateDaysAgo(4) },
	{ id: "seed-distribution-cancelled-taman-candi-rice", requestId: "seed-request-cancelled-taman-candi-rice", sourceCampId: "seed-camp-taman", destinationCampId: "seed-camp-candi", sourceItemId: "seed-item-taman-rice", createdById: headFor("seed-camp-taman", "LOGISTICS").id, itemName: "Beras Premium", quantity: 20, unit: "kg", notes: "Permintaan dibatalkan setelah pasokan lokal tiba.", status: "CANCELLED", createdAt: dateDaysAgo(9, 2), shippedAt: null, receivedAt: null },
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
	{ id: "seed-audit-system-created", userId: userData.admin.id, action: "SEED", entity: "System", entityId: null, details: { message: "Fixture operasional dibuat", version: "natural-names-2026-10" }, createdAt: dateDaysAgo(30) },
	{ id: "seed-audit-user-admin", userId: userData.admin.id, action: "CREATE", entity: "User", entityId: userData.admin.id, details: { name: userData.admin.name, role: userData.admin.role }, createdAt: dateDaysAgo(29) },
	...camps.map((camp, index) => ({ id: `seed-audit-camp-${camp.key}`, userId: userData.admin.id, action: "CREATE", entity: "Camp", entityId: camp.id, details: { name: camp.name, status: camp.status }, createdAt: dateDaysAgo(28 - index) })),
	...camps.flatMap((camp, index) => [
		{ id: `seed-audit-manager-${camp.key}`, userId: userData.admin.id, action: "ASSIGN_MANAGER", entity: "Camp", entityId: camp.id, details: { managerId: managerFor(camp.id).id }, createdAt: dateDaysAgo(22 - index) },
		...divisions.map((division, divisionIndex) => ({ id: `seed-audit-head-${camp.key}-${division.toLowerCase()}`, userId: userData.admin.id, action: "ASSIGN_DIVISION_HEAD", entity: "CampDivisionHead", entityId: `${camp.id}:${division}`, details: { division, userId: headFor(camp.id, division).id }, createdAt: dateDaysAgo(20 - index - divisionIndex) })),
	]),
	{ id: "seed-audit-stock-receipt", userId: headFor("seed-camp-candi", "LOGISTICS").id, action: "RECEIPT", entity: "InventoryMovement", entityId: "seed-item-candi-rice-receipt", details: { itemName: "Beras Premium", quantity: 850, unit: "kg" }, createdAt: dateDaysAgo(30) },
	{ id: "seed-audit-distribution-received", userId: headFor("seed-camp-waru", "LOGISTICS").id, action: "RECEIVE", entity: "Distribution", entityId: "seed-distribution-received-candi-waru-hygiene", details: { quantity: 30, itemName: "Paket Hygiene Kit Keluarga" }, createdAt: dateDaysAgo(4) },
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
	const existingById = await prisma.user.findUnique({ where: { id: user.id } });
	const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });

	let saved;
	if (existingById) {
		if (existingByEmail && existingByEmail.id !== existingById.id) {
			await prisma.user.delete({ where: { id: existingByEmail.id } }).catch(() => {});
		}
		saved = await prisma.user.update({
			where: { id: user.id },
			data: {
				name: user.name,
				email: user.email,
				password: passwordHash,
				role: user.role,
				division: user.division,
				campId: user.campId,
			},
		});
	} else if (existingByEmail) {
		saved = await prisma.user.update({
			where: { id: existingByEmail.id },
			data: {
				name: user.name,
				password: passwordHash,
				role: user.role,
				division: user.division,
				campId: user.campId,
			},
		});
	} else {
		saved = await prisma.user.create({
			data: {
				id: user.id,
				name: user.name,
				email: user.email,
				password: passwordHash,
				role: user.role,
				division: user.division,
				campId: user.campId,
				createdAt: dateDaysAgo(29),
			},
		});
	}
	user.id = saved.id;
	userIdMap.set(seedId, saved.id);
	return saved;
}

async function upsertLogisticsItem(item: LogisticsSeed) {
	const metadata = unitMetadata(item.unit);
	const quantityBase = item.quantity * metadata.conversionFactor;
	const reservedQuantityBase = item.reservedQuantity * metadata.conversionFactor;
	const damagedQuantityBase = item.damagedQuantity * metadata.conversionFactor;
	const minimumQuantityBase = item.minimumQuantity * metadata.conversionFactor;
	const data = { campId: item.campId, itemName: item.itemName, quantity: item.quantity, reservedQuantity: item.reservedQuantity, damagedQuantity: item.damagedQuantity, minimumQuantity: item.minimumQuantity, unit: item.unit, ...metadata, quantityBase, reservedQuantityBase, damagedQuantityBase, minimumQuantityBase, status: item.status, notes: item.notes, createdAt: dateDaysAgo(30) };
	return prisma.logisticsItem.upsert({ where: { id: item.id }, update: data, create: { id: item.id, ...data } });
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
	const metadata = unitMetadata(request.unit);
	const data = { sourceCampId: request.sourceCampId, destinationCampId: request.destinationCampId, createdById: request.createdById, reviewedById: request.reviewedById, itemName: request.itemName, quantity: request.quantity, unit: request.unit, requestedQuantity: request.quantity, requestedUnit: request.unit, baseQuantity: request.quantity * metadata.conversionFactor, baseUnit: metadata.baseUnit, unitDimension: metadata.unitDimension, conversionFactor: metadata.conversionFactor, conversionStatus: metadata.conversionStatus, notes: request.notes, rejectionReason: request.rejectionReason, status: request.status, createdAt: request.createdAt };
	return prisma.logisticsRequest.upsert({ where: { id: request.id }, update: data, create: { id: request.id, ...data } });
}

async function upsertDistribution(distribution: DistributionSeed) {
	const metadata = unitMetadata(distribution.unit);
	const data = { requestId: distribution.requestId, sourceCampId: distribution.sourceCampId, destinationCampId: distribution.destinationCampId, sourceItemId: distribution.sourceItemId, createdById: distribution.createdById, itemName: distribution.itemName, quantity: distribution.quantity, unit: distribution.unit, requestedQuantity: distribution.quantity, requestedUnit: distribution.unit, baseQuantity: distribution.quantity * metadata.conversionFactor, baseUnit: metadata.baseUnit, unitDimension: metadata.unitDimension, conversionFactor: metadata.conversionFactor, conversionStatus: metadata.conversionStatus, notes: distribution.notes, status: distribution.status, shippedAt: distribution.shippedAt, receivedAt: distribution.receivedAt, createdAt: distribution.createdAt };
	return prisma.distribution.upsert({ where: { id: distribution.id }, update: data, create: { id: distribution.id, ...data } });
}

async function upsertMovement(movement: MovementSeed) {
	const item = await prisma.logisticsItem.findUniqueOrThrow({ where: { id: movement.logisticsItemId }, select: { baseUnit: true, unitDimension: true, conversionFactor: true } });
	const data = { logisticsItemId: movement.logisticsItemId, campId: movement.campId, type: movement.type, quantity: movement.quantity, baseQuantity: movement.quantity * item.conversionFactor, baseUnit: item.baseUnit, unitDimension: item.unitDimension, conversionFactor: item.conversionFactor, reason: movement.reason, createdById: movement.createdById, distributionId: movement.distributionId, createdAt: movement.createdAt };
	return prisma.inventoryMovement.upsert({ where: { id: movement.id }, update: data, create: { id: movement.id, ...data } });
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
	console.log("Seeding operational fixture with natural Indonesian personnel and comprehensive stock items...");
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

	console.log(`Seed completed: ${camps.length} camps, ${userData.users.length} users (all with natural Indonesian names), ${logisticsItems.length} logistics items, ${facilities.length} facilities, ${evacuees.length} evacuee records, ${requests.length} requests, ${distributions.length} distributions, ${movements.length} inventory movements, ${auditLogs.length} audit logs.`);
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
