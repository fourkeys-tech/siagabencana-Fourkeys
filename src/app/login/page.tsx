"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/auth/user-provider";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Alert } from "@/components/ui/alert";

export default function LoginPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loading: sessionLoading, status } = useSession();
	const returnTo = searchParams.get("returnTo") || "/dashboard";

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!sessionLoading && status === "authenticated" && user) router.replace(returnTo.startsWith("/") ? returnTo : "/dashboard");
	}, [returnTo, router, sessionLoading, status, user]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (loading) return;

		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: email.trim(),
					password,
				}),
			});

			const data = await res.json();

			if (!res.ok || !data.success) {
				setError(data.message ?? "Email atau password salah.");
				return;
			}

			router.push(returnTo.startsWith("/") ? returnTo : "/dashboard");
			router.refresh();
		} catch {
			setError("Terjadi kesalahan. Silakan coba lagi.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthLayout>
			<div className="mb-8">
				<div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white lg:hidden">S</div>
				<h1 className="text-2xl font-bold tracking-tight text-slate-950">Selamat datang kembali</h1>
				<p className="mt-2 text-sm leading-6 text-slate-500">Masuk untuk melanjutkan ke command center Siaga Bencana.</p>
			</div>

			<form onSubmit={handleSubmit} className="space-y-4">
				{error && <div id="login-error" role="alert"><Alert type="error">{error}</Alert></div>}

				<div>
					<label htmlFor="email" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Email</label>

					<input
						id="email"
						name="email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="email"
						placeholder="nama@email.com"
						className="min-h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
						disabled={loading}
						required
					/>
				</div>

				<div>
					<label htmlFor="password" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Password</label>

					<input
						id="password"
						name="password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="current-password"
						placeholder="Masukkan password"
						className="min-h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
						disabled={loading}
						required
					/>
				</div>

				<Button
					type="submit"
					className="w-full"
					disabled={loading || sessionLoading}
				>
					{loading ? "Memuat..." : "Masuk"}
				</Button>
			</form>
		</AuthLayout>
	);
}