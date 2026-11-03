import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSerializationConflict } from "@/lib/prisma-errors";

export type Transaction = Prisma.TransactionClient;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Menjalankan transaksi Serializable dengan retry otomatis saat P2034 (konflik konkurensi).
export async function runSerializable<T>(operation: (tx: Transaction) => Promise<T>, maxRetries = 3): Promise<T> {
	let attempt = 0;
	while (attempt < maxRetries) {
		try {
			return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
		} catch (error) {
			attempt += 1;
			if (attempt < maxRetries && isSerializationConflict(error)) {
				const backoff = 25 * 2 ** attempt + Math.floor(Math.random() * 25);
				await sleep(backoff);
				continue;
			}
			throw error;
		}
	}
	throw new Error("P2034_EXHAUSTED");
}
