"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FormField, FormSelect } from "@/components/ui/form-field";

interface User {
	id: string;
	name: string;
	email: string;
	role: string;
	division: string | null;
	campId: string | null;
}

interface Camp {
	id: string;
	name: string;
}

export default function UserEditPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [user, setUser] = useState<User | null>(null);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		role: "",
		division: "",
		campId: "",
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!id) return;

		Promise.all([
			fetch(`/api/users/${id}`).then((res) => res.json()),
			fetch("/api/camps").then((res) => res.json()),
		])
			.then(([userData, campsData]) => {
				if (userData.success) {
					setUser(userData.data);
					setFormData({
						name: userData.data.name,
						email: userData.data.email,
						password: "", // Password is not sent back from API
						role: userData.data.role,
						division: userData.data.division ?? "",
						campId: userData.data.campId ?? "",
					});
				} else {
					setError(userData.message ?? "Gagal memuat data pengguna");
				}
				if (campsData.success) {
					setCamps(campsData.data);
				}
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setError("");

		try {
			const res = await fetch(`/api/users/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formData.name,
					email: formData.email,
					...(formData.password && { password: formData.password }), // Only send password if it's changed
					role: formData.role,
					division: formData.role !== "SUPER_ADMIN" ? formData.division : null,
					campId: formData.role !== "SUPER_ADMIN" ? formData.campId : null,
				}),
			});

			const data = await res.json();

			if (data.success) {
				router.push(`/users/${id}`);
				router.refresh();
			} else {
				setError(data.message ?? "Gagal memperbarui pengguna");
			}
		} catch {
			setError("Terjadi kesalahan");
		} finally {
			setSubmitting(false);
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

	const isSuperAdmin = formData.role === "SUPER_ADMIN";

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">
				Edit Pengguna: {user.name}
			</h1>

			{error && <Alert type="error">{error}</Alert>}

			<form onSubmit={handleSubmit} className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
				<FormField
					label="Nama"
					value={formData.name}
					onChange={(v) =>
						setFormData({ ...formData, name: v })
					}
					required
				/>
				<FormField
					label="Email"
					type="email"
					value={formData.email}
					onChange={(v) =>
						setFormData({ ...formData, email: v })
					}
					required
				/>
				<FormField
					label="Password (kosongkan jika tidak diubah)"
					type="password"
					value={formData.password}
					onChange={(v) =>
						setFormData({ ...formData, password: v })
					}
				/>
				<FormSelect
					label="Peran"
					value={formData.role}
					onChange={(v) =>
						setFormData({ ...formData, role: v, division: v === "SUPER_ADMIN" ? "" : formData.division, campId: v === "SUPER_ADMIN" ? "" : formData.campId, })
					}
					options={[
						{ value: "SUPER_ADMIN", label: "Super Admin" },
						{ value: "MANAGER", label: "Manager" },
						{ value: "FIELD_OFFICER", label: "Field Officer" },
					]}
					required
				/>
				{!isSuperAdmin && (
					<FormSelect
						label="Divisi"
						value={formData.division}
						onChange={(v) =>
							setFormData({ ...formData, division: v })
						}
						options={[
							{ value: "", label: "Pilih Divisi" },
							{ value: "LOGISTICS", label: "Logistik" },
							{ value: "SHELTER", label: "Shelter" },
							{ value: "DATA_REGISTRATION", label: "Data Registration" },
						]}
						required={!isSuperAdmin}
					/>
				)}
				{!isSuperAdmin && (
					<FormSelect
						label="Posko"
						value={formData.campId}
						onChange={(v) =>
							setFormData({ ...formData, campId: v })
						}
						options={[
							{ value: "", label: "Pilih Posko" },
							...camps.map((camp) => ({ value: camp.id, label: camp.name })),
						]}
						required={!isSuperAdmin}
					/>
				)}
				<div className="flex justify-end gap-3 mt-6">
					<Link href={`/users/${user.id}`}>
						<Button type="button" variant="secondary">
							Batal
						</Button>
					</Link>
					<Button type="submit" disabled={submitting}>
						{submitting ? "Menyimpan..." : "Simpan Perubahan"}
					</Button>
				</div>
			</form>
		</div>
	);
}
