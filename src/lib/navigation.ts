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
			{ href: "/kelola-posko", label: "Kelola Posko" },
			{ href: "/logistik", label: "Logistik" },
			{ href: "/shelter", label: "Shelter" },
			{ href: "/pengungsi", label: "Pengungsi" },
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

export function isItemVisible(item: NavItem, user: SessionUser | null) {
	if (item.roles && !user) return false;

	if (item.roles && user && !item.roles.includes(user.role)) {
		return false;
	}

	if (
		item.divisions &&
		user?.role !== "SUPER_ADMIN" &&
		(!user?.division || !item.divisions.includes(user.division))
	) {
		return false;
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

	if (!match) return true;

	if (match.item.disabled) return false;

	return isItemVisible(match.item, user);
}

export function getBreadcrumb(pathname: string) {
	return findNavItem(pathname);
}
