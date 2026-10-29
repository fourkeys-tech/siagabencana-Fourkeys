import { Prisma } from "@prisma/client";

// P2003: foreign key constraint gagal (mis. relasi onDelete: Restrict).
export function isForeignKeyError(error: unknown) {
	return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

// P2034: transaksi Serializable bentrok dengan transaksi lain (write conflict / deadlock).
export function isSerializationConflict(error: unknown) {
	return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

// P2002: unique constraint gagal (mis. email sudah dipakai).
export function isUniqueConstraintError(error: unknown) {
	return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const SERIALIZATION_CONFLICT_MESSAGE = "Data sedang diperbarui pengguna lain. Silakan coba lagi.";
