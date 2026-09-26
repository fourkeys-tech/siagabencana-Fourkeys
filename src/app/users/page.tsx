"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FormField, FormSelect } from "@/components/ui/form-field";

interface User {
	id: string;
	name: string;
	email: string;
	role: string;
	division: string | null;
	camp: { name: string } | null;
	createdAt: string;
}

export default function UsersPage() {
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		role: "MANAGER",
		division: "",
		campId: "",
	});

	const loadData = useCallback(() => {
		return fetch("/api/users")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setUsers(data.data);
				else setError(data.message ?? "Gagal memuat data");
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleCreate = async () => {
		try {
			const res = await fetch("/api/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});
			const data = await res.json();
			if (data.success) {
				setShowModal(false);
				setFormData({ name: "", email: "", password: "", role: "MANAGER", division: "", campId: "" });
				loadData();
			} else {
				setError(data.message);
			}
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus pengguna ini?")) return;
		try {
			const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) loadData();
			else setError(data.message);
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-gray-900">
					Pengguna
				</h1>
				<Button onClick={() => setShowModal(true)}>
					+ Tambah Pengguna
				</Button>
			</div>

			{error && (
				<Alert type="error">{error}</Alert>
			)}

			{loading ? (
				<div className="flex items-center justify-center h-64">
					<span className="text-gray-500">Memuat...</span>
				</div>
			) : (
				<div className="bg-white rounded-lg border overflow-hidden">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Nama
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Email
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Peran
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Divisi
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Posko
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Aksi
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{users.map((user) => (
								<tr key={user.id} className="hover:bg-gray-50">
									<td className="px-6 py-4 text-sm font-medium text-gray-900">
										{user.name}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{user.email}
									</td>
									<td className="px-6 py-4">
										<Badge label={user.role} />
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{user.division ?? "-"}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{user.camp?.name ?? "-"}
									</td>
									<td className="px-6 py-4 text-sm">
										<button
											onClick={() =>
												handleDelete(user.id)
											}
											className="text-red-600 hover:underline"
										>
											Hapus
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<Modal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				title="Tambah Pengguna"
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleCreate();
					}}
					className="space-y-3"
				>
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
						label="Password"
						type="password"
						value={formData.password}
						onChange={(v) =>
							setFormData({ ...formData, password: v })
						}
						required
					/>
					<FormSelect
						label="Peran"
						value={formData.role}
						onChange={(v) =>
							setFormData({ ...formData, role: v })
						}
						options={[
							{ value: "SUPER_ADMIN", label: "Super Admin" },
							{ value: "MANAGER", label: "Manager" },
							{ value: "FIELD_OFFICER", label: "Field Officer" },
						]}
					/>
					<FormSelect
						label="Divisi"
						value={formData.division}
						onChange={(v) =>
							setFormData({ ...formData, division: v })
						}
						options={[
							{ value: "LOGISTICS", label: "Logistik" },
							{ value: "SHELTER", label: "Shelter" },
							{ value: "DATA_REGISTRATION", label: "Data Registration" },
						]}
					/>
					<FormField
						label="Camp ID"
						value={formData.campId}
						onChange={(v) =>
							setFormData({ ...formData, campId: v })
						}
						placeholder="ID posko (opsional untuk SUPER_ADMIN)"
					/>
					<div className="flex gap-2 justify-end mt-4">
						<Button
							type="button"
							variant="secondary"
							onClick={() => setShowModal(false)}
						>
							Batal
						</Button>
						<Button type="submit">Simpan</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
