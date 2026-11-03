import { fail } from "@/lib/api-response";
import { authError, isAuthError } from "@/lib/auth/guard";
import { domainError, SERIALIZATION_CONFLICT_MESSAGE, type DomainErrorCode } from "@/lib/domain-errors";
import { invalidJsonResponse, isInvalidJson } from "@/lib/http";
import { isForeignKeyError, isSerializationConflict, isUniqueConstraintError, violatesUnique } from "@/lib/prisma-errors";

export type RouteErrorOptions = {
	/** Label log, mis. "UPDATE_CAMP_ERROR". */
	context: string;
	/** Pesan 500 untuk error tak terduga. */
	fallback: string;
	forbiddenMessage?: string;
	/** Bila diisi, P2003 (masih direferensikan) dibalas 409 dengan pesan ini. */
	foreignKeyMessage?: string;
	/** Override pesan domain yang lebih spesifik untuk route ini. */
	messages?: Partial<Record<DomainErrorCode, string>>;
};

// Pesan P2002 per constraint; urutan dari yang paling spesifik.
const UNIQUE_MESSAGES: Array<{ columns: string[]; message: string }> = [
	{ columns: ["email"], message: "Email sudah digunakan." },
	{ columns: ["managerId"], message: "Manager tersebut sudah memimpin posko lain." },
	{ columns: ["campId", "division"], message: "Divisi tersebut sudah memiliki ketua di posko ini." },
	{ columns: ["userId", "campId"], message: "User sudah menjadi ketua divisi di posko ini." },
	{ columns: ["requestId"], message: "Permintaan ini sudah memiliki distribusi." },
];

export function uniqueConstraintMessage(error: unknown) {
	return UNIQUE_MESSAGES.find(({ columns }) => violatesUnique(error, ...columns))?.message ?? "Data yang sama sudah ada. Muat ulang data lalu coba lagi.";
}

// Urutan: JSON rusak → auth → konflik Serializable → error domain → unique → FK → 500.
export function handleRouteError(error: unknown, options: RouteErrorOptions) {
	if (isInvalidJson(error)) return invalidJsonResponse();
	if (isAuthError(error)) return authError(error, options.forbiddenMessage);
	if (isSerializationConflict(error)) return fail(SERIALIZATION_CONFLICT_MESSAGE, 409);

	const known = domainError(error);
	if (known) {
		const code = (error as Error).message as DomainErrorCode;
		return fail(options.messages?.[code] ?? known.message, known.status);
	}

	if (isUniqueConstraintError(error)) return fail(uniqueConstraintMessage(error), 409);
	if (options.foreignKeyMessage && isForeignKeyError(error)) return fail(options.foreignKeyMessage, 409);

	console.error(options.context, error);
	return fail(options.fallback, 500);
}
