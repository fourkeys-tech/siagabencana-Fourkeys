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

type DriverAdapterMeta = { driverAdapterError?: { cause?: { constraint?: { fields?: unknown; index?: unknown } } } };

// Kolom/constraint yang dilanggar P2002. Engine klasik mengisi meta.target; driver adapter (adapter-pg)
// mengisi meta.driverAdapterError.cause.constraint berupa { fields } atau { index: "Model_kolom_key" }.
export function uniqueConstraintFields(error: unknown): string[] {
	if (!isUniqueConstraintError(error)) return [];
	const meta = (error as Prisma.PrismaClientKnownRequestError).meta as (Record<string, unknown> & DriverAdapterMeta) | undefined;
	if (!meta) return [];
	if (Array.isArray(meta.target)) return meta.target.map(String);
	if (typeof meta.target === "string") return [meta.target];
	const constraint = meta.driverAdapterError?.cause?.constraint;
	if (Array.isArray(constraint?.fields)) return constraint.fields.map((field) => String(field).replace(/"/g, ""));
	if (typeof constraint?.index === "string") return [constraint.index];
	return [];
}

/** true bila P2002 melanggar constraint yang memuat SEMUA kolom (mis. "email" cocok dengan "User_email_key"). */
export function violatesUnique(error: unknown, ...columns: string[]) {
	const parts = new Set(uniqueConstraintFields(error).flatMap((field) => field.split("_")));
	return columns.length > 0 && columns.every((column) => parts.has(column));
}

export { SERIALIZATION_CONFLICT_MESSAGE } from "@/lib/domain-errors";
