import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
    connectionString,
});

const prisma = new PrismaClient({
    adapter,
});

async function main() {
    console.log("🌱 Seeding database...");

    // =========================
    // PASSWORD
    // =========================

    const passwordHash = await bcrypt.hash("password", 12);

    // =========================
    // CAMPS
    // =========================

    const camp1 = await prisma.camp.create({
        data: {
            name: "Posko Evakuasi Balai Desa Candi",
            address: "Balai Desa Candi, Sidoarjo",
            latitude: -7.4716,
            longitude: 112.6946,
            maxCapacity: 200,
            status: "ACTIVE",
        },
    });

    const camp2 = await prisma.camp.create({
        data: {
            name: "Posko Evakuasi GOR Sidoarjo",
            address: "GOR Sidoarjo, Sidoarjo",
            latitude: -7.4478,
            longitude: 112.7183,
            maxCapacity: 500,
            status: "ACTIVE",
        },
    });

    const camp3 = await prisma.camp.create({
        data: {
            name: "Posko Evakuasi Lapangan Taman",
            address: "Lapangan Taman, Sidoarjo",
            latitude: -7.3645,
            longitude: 112.6974,
            maxCapacity: 300,
            status: "ACTIVE",
        },
    });

    console.log("✅ Camps created");

    // =========================
    // SUPER ADMIN
    // =========================

    await prisma.user.create({
        data: {
            name: "Super Administrator",
            email: "admin@siagabencana.local",
            password: passwordHash,
            role: "SUPER_ADMIN",
        },
    });

    // =========================
    // MANAGERS
    // =========================

    await prisma.user.createMany({
        data: [
            {
                name: "Manager Logistik Candi",
                email: "manager.logistik.candi@siagabencana.local",
                password: passwordHash,
                role: "MANAGER",
                division: "LOGISTICS",
                campId: camp1.id,
            },
            {
                name: "Manager Shelter Candi",
                email: "manager.shelter.candi@siagabencana.local",
                password: passwordHash,
                role: "MANAGER",
                division: "SHELTER",
                campId: camp1.id,
            },
            {
                name: "Manager Data Candi",
                email: "manager.data.candi@siagabencana.local",
                password: passwordHash,
                role: "MANAGER",
                division: "DATA_REGISTRATION",
                campId: camp1.id,
            },
        ],
    });

    // =========================
    // FIELD OFFICERS
    // =========================

    await prisma.user.createMany({
        data: [
            {
                name: "Field Officer Logistik Candi",
                email: "field.logistik.candi@siagabencana.local",
                password: passwordHash,
                role: "FIELD_OFFICER",
                division: "LOGISTICS",
                campId: camp1.id,
            },
            {
                name: "Field Officer Shelter Candi",
                email: "field.shelter.candi@siagabencana.local",
                password: passwordHash,
                role: "FIELD_OFFICER",
                division: "SHELTER",
                campId: camp1.id,
            },
            {
                name: "Field Officer Data Candi",
                email: "field.data.candi@siagabencana.local",
                password: passwordHash,
                role: "FIELD_OFFICER",
                division: "DATA_REGISTRATION",
                campId: camp1.id,
            },
        ],
    });

    console.log("✅ Users created");

    // =========================
    // LOGISTICS
    // =========================

    await prisma.logisticsItem.createMany({
        data: [
            {
                campId: camp1.id,
                itemName: "Beras",
                quantity: 250,
                unit: "kg",
                status: "SUFFICIENT",
                notes: "Stok aman untuk beberapa hari",
            },
            {
                campId: camp1.id,
                itemName: "Air Mineral",
                quantity: 120,
                unit: "dus",
                status: "SUFFICIENT",
                notes: null,
            },
            {
                campId: camp1.id,
                itemName: "Obat-obatan",
                quantity: 35,
                unit: "box",
                status: "LOW",
                notes: "Perlu pengadaan tambahan",
            },
            {
                campId: camp1.id,
                itemName: "Selimut",
                quantity: 10,
                unit: "pcs",
                status: "CRITICAL",
                notes: "Stok hampir habis",
            },
        ],
    });

    console.log("✅ Logistics data created");

    // =========================
    // FACILITIES
    // =========================

    await prisma.facilityReport.createMany({
        data: [
            {
                campId: camp1.id,
                facilityName: "Toilet",
                status: "GOOD",
                description: "Toilet masih berfungsi dengan baik.",
            },
            {
                campId: camp1.id,
                facilityName: "Listrik",
                status: "GOOD",
                description: "Listrik tersedia dan berjalan normal.",
            },
            {
                campId: camp1.id,
                facilityName: "Tenda Pengungsian",
                status: "DAMAGED",
                description: "Beberapa bagian tenda mengalami kerusakan.",
            },
        ],
    });

    console.log("✅ Facility data created");

    // =========================
    // EVACUEES
    // =========================

    const evacuees = [
        {
            name: "Keluarga Budi",
            totalFamily: 4,
            hasSpecialNeeds: false,
            notes: "Datang bersama keluarga",
        },
        {
            name: "Keluarga Siti",
            totalFamily: 3,
            hasSpecialNeeds: true,
            notes: "1 anggota keluarga lansia",
        },
        {
            name: "Keluarga Andi",
            totalFamily: 5,
            hasSpecialNeeds: false,
            notes: null,
        },
        {
            name: "Keluarga Rina",
            totalFamily: 2,
            hasSpecialNeeds: false,
            notes: null,
        },
    ];

    await prisma.evacueeRecord.createMany({
        data: evacuees.map((evacuee) => ({
            campId: camp1.id,
            ...evacuee,
        })),
    });

    // Update current occupants
    const totalOccupants = evacuees.reduce(
        (total, evacuee) => total + evacuee.totalFamily,
        0,
    );

    await prisma.camp.update({
        where: {
            id: camp1.id,
        },
        data: {
            currentOccupants: totalOccupants,
        },
    });

    console.log("✅ Evacuee data created");

    // =========================
    // SUMMARY
    // =========================

    console.log("");
    console.log("🎉 Database seeding completed!");
    console.log("");
    console.log("📍 Camps:");
    console.log(`   - ${camp1.name}`);
    console.log(`   - ${camp2.name}`);
    console.log(`   - ${camp3.name}`);
    console.log("");
    console.log("👤 Login accounts:");
    console.log("");
    console.log("SUPER ADMIN");
    console.log("   Email    : admin@siagabencana.local");
    console.log("   Password : password");
    console.log("");
    console.log("MANAGERS");
    console.log("   manager.logistik.candi@siagabencana.local");
    console.log("   manager.shelter.candi@siagabencana.local");
    console.log("   manager.data.candi@siagabencana.local");
    console.log("");
    console.log("FIELD OFFICERS");
    console.log("   field.logistik.candi@siagabencana.local");
    console.log("   field.shelter.candi@siagabencana.local");
    console.log("   field.data.candi@siagabencana.local");
    console.log("");
    console.log("Password semua akun: password");
}

main()
    .catch((error) => {
        console.error("❌ Seed failed:");
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });