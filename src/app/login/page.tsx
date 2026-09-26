"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Alert } from "@/components/ui/alert";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});

			const data = await res.json();

			if (data.success) {
				router.push("/dashboard");
				router.refresh();
			} else {
				setError(data.message ?? "Login gagal");
			}
		} catch {
			setError("Terjadi kesalahan");
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthLayout>
			<h1 className="text-2xl font-bold text-center mb-6 text-gray-900">
				Masuk ke Siaga Bencana
			</h1>
			<form onSubmit={handleSubmit} className="space-y-4">
				{error && (
					<Alert type="error">{error}</Alert>
				)}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Email
					</label>
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						required
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Password
					</label>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						required
					/>
				</div>
				<Button
					type="submit"
					className="w-full"
					disabled={loading}
				>
					{loading ? "Memasuk..." : "Masuk"}
				</Button>
			</form>
		</AuthLayout>
	);
}
