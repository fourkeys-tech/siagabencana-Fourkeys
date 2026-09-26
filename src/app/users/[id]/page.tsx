"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
		return <Alert type="error">{error}</Alert>;
	}

	if (!user) {
		return <Alert type="info">Pengguna tidak ditemukan.</Alert>;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-gray-900">
					Detail Pengguna: {user.name}
				</h1>
				<div className="flex gap-2">
					<Link href={`/users/${user.id}/edit`}>
						<Button variant="secondary">Edit</Button>
					</Link>
					<Button variant="danger" onClick={handleDelete}>
						Hapus
					</Button>
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
