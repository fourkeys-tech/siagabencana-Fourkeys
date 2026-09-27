import { prisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
	userId?: string | null;
	action: string;
	entity: string;
	entityId?: string | null;
	details?: unknown;
}) {
	try {
		await prisma.auditLog.create({
			data: {
				userId: input.userId ?? null,
				action: input.action,
				entity: input.entity,
				entityId: input.entityId ?? null,
				details:
					input.details === undefined
						? null
						: JSON.stringify(input.details),
			},
		});
	} catch (error) {
		console.error("AUDIT_LOG_ERROR", error);
	}
}
