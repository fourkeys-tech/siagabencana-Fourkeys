import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
    }

    const adapter = new PrismaPg({
        connectionString,
        max: 15,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
    });

    return new PrismaClient({
        adapter,
    });
}

export const prisma =
    globalForPrisma.prisma ??
    createPrismaClient();

// Simpan di globalThis pada semua environment agar warm container serverless me-reuse connection pool
globalForPrisma.prisma = prisma;