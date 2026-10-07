"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/components/auth/user-provider";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface User {
	id: string;
	name: string;
	email: string;
	role: string;
	division: string | null;
	camp: { name: string } | null;
	createdAt: string;
	updatedAt: string;
}

export default function UserDetailPage() {
	const params = useParams();
	const router = useRouter();
	const { user: currentUser } = useSession();
	const { id } = params;

	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!id) return;

		fetch(`/api/users/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setUser(data.data);
				else setError(data.message ?? "Gagal memuat data pengguna");
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleDelete = async () => {
		if (!user) return;
		if (!confirm(`Hapus pengguna "${user.name}"?`)) return;

		try {
			const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) {
				router.push("/users");
				router.refresh();
			} else {
				setError(data.message);
			}
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<span className="text-gray-500 text-lg">
					Memuat...
				</span>
			</div>
		);
	}

	if (error) {
		return <div className="space-y-4"><Alert type="error">{error}</Alert><Link href="/users"><Button variant="secondary">Kembali ke Pengguna</Button></Link></div>;
	}

	if (!user) {
		return <div className="space-y-4"><Alert type="info">Pengguna tidak ditemukan.</Alert><Link href="/users"><Button variant="secondary">Kembali ke Pengguna</Button></Link></div>;
	}

	return (
		<div className="space-y-6">
			<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div><Link href="/users" className="text-sm font-medium text-blue-600 hover:underline">← Kembali ke Pengguna</Link><h1 className="mt-2 text-2xl font-bold text-gray-900">Detail Pengguna: {user.name}</h1></div>
				<div className="flex gap-2">
					<Link href={`/users/${user.id}/edit`}>
						<Button variant="secondary">Edit</Button>
					</Link>
					{currentUser?.role === "SUPER_ADMIN" && user.id !== currentUser.id && <Button variant="danger" onClick={handleDelete}>
						Hapus
					</Button>}
				</div>
			</div>

			<div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
				<div>
					<p className="text-sm font-medium text-gray-500">Nama</p>
					<p className="text-gray-900">{user.name}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Email</p>
					<p className="text-gray-900">{user.email}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Peran</p>
					<Badge label={user.role} />
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Divisi</p>
					<p className="text-gray-900">{user.division ?? "-"}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Posko</p>
					<p className="text-gray-900">{user.camp?.name ?? "-"}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Dibuat Pada</p>
					<p className="text-gray-900">
						{new Date(user.createdAt).toLocaleString("id-ID")}
					</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Diperbarui Pada</p>
					<p className="text-gray-900">
						{new Date(user.updatedAt).toLocaleString("id-ID")}
					</p>
				</div>
			</div>
		</div>
	);
}
