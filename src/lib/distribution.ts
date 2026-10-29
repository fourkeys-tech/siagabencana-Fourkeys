export type DistributionUser = {
	role: string;
	division: string | null;
	campId: string | null;
};

// Akses menu/API distribusi: Super Admin, Manager posko, atau tim logistik posko.
export function hasDistributionAccess(user: DistributionUser) {
	if (user.role === "SUPER_ADMIN") return true;
	if (!user.campId) return false;
	if (user.role === "MANAGER") return true;
	return (user.role === "DIVISION_HEAD" || user.role === "FIELD_OFFICER") && user.division === "LOGISTICS";
}

// Pemohon atau Manager posko tujuan boleh menarik permintaan yang belum direview.
// Pembuat hanya boleh menarik jika masih bertugas di posko tujuan (atau Super Admin).
export function canWithdrawRequest(
	user: DistributionUser & { id: string },
	request: { createdById: string; destinationCampId: string },
) {
	if (user.role === "SUPER_ADMIN") return true;
	if (user.role === "MANAGER") return user.campId === request.destinationCampId;
	return request.createdById === user.id && user.campId === request.destinationCampId;
}

export function canAccessCamp(user: DistributionUser, campId: string) {
	return (
		user.role === "SUPER_ADMIN" ||
		user.campId === campId
	);
}

export function canManageRequest(
	user: DistributionUser,
	sourceCampId: string,
	destinationCampId: string,
) {
	if (user.role === "SUPER_ADMIN") return true;
	if (user.role === "MANAGER") {
		return user.campId === sourceCampId || user.campId === destinationCampId;
	}
	return (
		(user.role === "DIVISION_HEAD" || user.role === "FIELD_OFFICER") &&
		user.division === "LOGISTICS" &&
		(user.campId === sourceCampId || user.campId === destinationCampId)
	);
}

export function canReviewRequest(
	user: DistributionUser,
	sourceCampId: string,
) {
	if (user.role === "SUPER_ADMIN") return true;
	if (user.role === "MANAGER") return user.campId === sourceCampId;
	return (
		(user.role === "DIVISION_HEAD" || user.role === "FIELD_OFFICER") &&
		user.division === "LOGISTICS" &&
		user.campId === sourceCampId
	);
}

export function canReceiveDistribution(
	user: DistributionUser,
	destinationCampId: string,
) {
	if (user.role === "SUPER_ADMIN") return true;
	if (user.role === "MANAGER") return user.campId === destinationCampId;
	return (
		(user.role === "DIVISION_HEAD" || user.role === "FIELD_OFFICER") &&
		user.division === "LOGISTICS" &&
		user.campId === destinationCampId
	);
}

export function isPositiveInteger(value: unknown) {
	return Number.isInteger(Number(value)) && Number(value) > 0;
}
