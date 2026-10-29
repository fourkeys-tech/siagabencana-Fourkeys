export type SessionUser = {
	id: string;
	name: string;
	email: string;
	role: string;
	division?: string | null;
	campId?: string | null;
	camp?: {
		id: string;
		name: string;
	} | null;
};

// Konstanta role & division sebagai fallback type (saat runtime berasal dari Prisma enum).
export const ROLES = {
	SUPER_ADMIN: "SUPER_ADMIN",
	MANAGER: "MANAGER",
	DIVISION_HEAD: "DIVISION_HEAD",
	FIELD_OFFICER: "FIELD_OFFICER",
} as const;

export const DIVISIONS = {
	LOGISTICS: "LOGISTICS",
	SHELTER: "SHELTER",
	DATA_REGISTRATION: "DATA_REGISTRATION",
} as const;

export type NavItem = {
	href: string;
	label: string;
	roles?: string[];
	divisions?: string[];
	disabled?: boolean;
};

export type NavSection = {
	id: string;
	label: string;
	items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
	{
		id: "OVERVIEW",
		label: "Overview",
		items: [
			{ href: "/dashboard", label: "Dashboard" },
			{ href: "/monitoring", label: "Monitoring" },
			{ href: "/peta", label: "Peta Bencana" },
		],
	},
	{
		id: "OPERASIONAL",
		label: "Operasional",
		items: [
			{ href: "/kelola-posko", label: "Kelola Posko", roles: ["SUPER_ADMIN", "MANAGER"] },
			{ href: "/logistik", label: "Logistik", divisions: ["LOGISTICS"] },
			{ href: "/shelter", label: "Shelter", divisions: ["SHELTER"] },
			{ href: "/pengungsi", label: "Pengungsi", divisions: ["DATA_REGISTRATION"] },
			{
				href: "/distribusi",
				label: "Distribusi",
				roles: ["SUPER_ADMIN", "MANAGER", "DIVISION_HEAD", "FIELD_OFFICER"],
				divisions: ["LOGISTICS"],
			},
		],
	},
	{
		id: "DATA_INFORMASI",
		label: "Data & Informasi",
		items: [
			{ href: "/laporan", label: "Laporan" },
			{ href: "/aktivitas", label: "Riwayat Aktivitas" },
		],
	},
	{
		id: "ADMINISTRASI",
		label: "Administrasi",
		items: [
			{
				href: "/users",
				label: "Pengguna",
				roles: ["SUPER_ADMIN", "MANAGER"],
			},
			{ href: "/pengaturan", label: "Pengaturan" },
		],
	},
];

// Routes yang hanya boleh diakses jika user sudah login (authenticated).
// Digunakan untuk halaman detail/edit dinamis yang tidak didefinisikan di NAV_SECTIONS
// seperti /users/:id/edit, /logistik/:id, dll.
export const PROTECTED_PARENT_ROUTES: string[] = [
	"/users",
	"/kelola-posko",
	"/logistik",
	"/pengungsi",
	"/shelter",
];

export function isProtectedPath(pathname: string) {
	return PROTECTED_PARENT_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isItemVisible(item: NavItem, user: SessionUser | null) {
	if (item.roles && !user) return false;

	if (item.roles && user && !item.roles.includes(user.role)) {
		return false;
	}

	// Selaras dengan canManageDivision: Super Admin & Manager tanpa divisi melihat semua divisi.
	if (item.divisions) {
		if (!user) return false;
		const bypass = user.role === "SUPER_ADMIN" || (user.role === "MANAGER" && !user.division);
		if (!bypass && (!user.division || !item.divisions.includes(user.division))) return false;
	}

	return true;
}

function matchesPath(pathname: string, href: string) {
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavItem(pathname: string) {
	for (const section of NAV_SECTIONS) {
		for (const item of section.items) {
			if (matchesPath(pathname, item.href)) {
				return { section, item };
			}
		}
	}

	return null;
}

export function canAccessPath(pathname: string, user: SessionUser | null) {
	const match = findNavItem(pathname);

	if (match) {
		if (match.item.disabled) return false;
		return isItemVisible(match.item, user);
	}

	// Untuk path yang tidak ada di NAV_SECTIONS (mis. halaman detail/edit dinamis),
	// tetap wajib user terautentikasi.
	if (isProtectedPath(pathname)) {
		return Boolean(user);
	}

	return true;
}

// Hanya path internal: "/x" boleh, "//evil.com" atau "/\evil.com" (protocol-relative) ditolak.
export function safeReturnTo(value: string | null | undefined, fallback = "/dashboard") {
	if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
	if (/[\u0000-\u001f]/.test(value)) return fallback;
	return value;
}

export function getBreadcrumb(pathname: string) {
	return findNavItem(pathname);
}
