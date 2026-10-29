import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		console.error("DATABASE_URL is not set.");
		process.exit(1);
	}

	const adapter = new PrismaPg({ connectionString });
	const prisma = new PrismaClient({ adapter });

	const applyChanges = process.argv.includes("--apply");

	console.log(`Starting occupancy reconciliation... (Mode: ${applyChanges ? "APPLY" : "DRY-RUN"})`);

	try {
		const [camps, evacueeSums] = await Promise.all([
			prisma.camp.findMany({
				select: {
					id: true,
					name: true,
					maxCapacity: true,
					currentOccupants: true,
				},
				orderBy: { name: "asc" },
			}),
			prisma.evacueeRecord.groupBy({
				by: ["campId"],
				where: { departedAt: null },
				_sum: { totalFamily: true },
			}),
		]);

		const actualByCamp = new Map<string, number>();
		for (const row of evacueeSums) {
			actualByCamp.set(row.campId, row._sum.totalFamily ?? 0);
		}

		let discrepancies = 0;

		for (const camp of camps) {
			const actual = actualByCamp.get(camp.id) ?? 0;
			if (camp.currentOccupants !== actual) {
				discrepancies++;
				console.log(
					`[MISMATCH] ${camp.name} (${camp.id}): DB currentOccupants=${camp.currentOccupants}, Actual active=${actual} (Diff: ${actual - camp.currentOccupants})`,
				);

				if (applyChanges) {
					if (actual > camp.maxCapacity) {
						console.warn(
							`  WARNING: Actual occupants (${actual}) exceeds maxCapacity (${camp.maxCapacity})! Updating anyway to reflect real state.`,
						);
					}
					await prisma.camp.update({
						where: { id: camp.id },
						data: { currentOccupants: actual },
					});
					console.log(`  -> Updated currentOccupants to ${actual}`);
				}
			}
		}

		if (discrepancies === 0) {
			console.log("All camp occupancy records match actual active evacuee sums perfectly.");
		} else {
			console.log(
				`\nFound ${discrepancies} camp(s) with discrepancies.${
					applyChanges ? " All discrepancies reconciled." : " Run with --apply to apply reconciliation."
				}`,
			);
		}
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error("Reconciliation error:", err);
	process.exit(1);
});
