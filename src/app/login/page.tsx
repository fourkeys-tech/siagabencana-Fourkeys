"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/auth/user-provider";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Alert } from "@/components/ui/alert";
import { safeReturnTo } from "@/lib/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loading: sessionLoading, status, refresh } = useSession();
	const returnTo = safeReturnTo(searchParams.get("returnTo"));

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!sessionLoading && status === "authenticated" && user) {
			router.replace(returnTo);
		}
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
				setError(data.message ?? "Email atau kata sandi salah. Silakan periksa kembali.");
				return;
			}

			await refresh();
			router.replace(returnTo);
		} catch {
			setError("Terjadi kesalahan jaringan atau server. Silakan coba lagi.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthLayout>
			{/* Mobile Branding Header */}
			<div className="mb-6 flex items-center justify-between lg:hidden">
				<Link
					href="/public"
					aria-label="Kembali ke Informasi Publik Siaga Bencana"
					className="flex items-center rounded-xl bg-[#0b1730] px-3.5 py-2 shadow-sm border border-slate-800"
				>
					<Image
						src="/sidebar.svg"
						alt="Fourkeys Siaga Bencana"
						width={170}
						height={45}
						priority
						className="h-7 w-auto object-contain"
					/>
				</Link>
				<Link
					href="/public"
					className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
				>
					Portal Publik →
				</Link>
			</div>

			{/* Form Header */}
			<div className="mb-7">
				<h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
					Selamat Datang
				</h1>
				<p className="mt-2 text-sm leading-relaxed text-slate-500">
					Masuk untuk mengakses command center dan pengelolaan operasional Siaga Bencana.
				</p>
			</div>

			{/* Form */}
			<form onSubmit={handleSubmit} className="space-y-4">
				{error && (
					<div id="login-error" role="alert" className="animate-in fade-in duration-200">
						<Alert type="error">{error}</Alert>
					</div>
				)}

				{/* Email Field */}
				<div>
					<label
						htmlFor="email"
						className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
					>
						Email Petugas
					</label>
					<div className="relative">
						<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
							<Mail className="h-4 w-4" aria-hidden="true" />
						</div>
						<input
							id="email"
							name="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							autoComplete="email"
							placeholder="nama@email.com"
							className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:cursor-not-allowed"
							disabled={loading || sessionLoading}
							required
						/>
					</div>
				</div>

				{/* Password Field */}
				<div>
					<div className="mb-1.5 flex items-center justify-between">
						<label
							htmlFor="password"
							className="block text-xs font-bold uppercase tracking-wider text-slate-700"
						>
							Kata Sandi
						</label>
					</div>
					<div className="relative">
						<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
							<Lock className="h-4 w-4" aria-hidden="true" />
						</div>
						<input
							id="password"
							name="password"
							type={showPassword ? "text" : "password"}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoComplete="current-password"
							placeholder="Masukkan kata sandi"
							className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-11 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:cursor-not-allowed"
							disabled={loading || sessionLoading}
							required
						/>
						<button
							type="button"
							onClick={() => setShowPassword((prev) => !prev)}
							className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-800 transition"
							aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
							tabIndex={-1}
						>
							{showPassword ? (
								<EyeOff className="h-4 w-4" aria-hidden="true" />
							) : (
								<Eye className="h-4 w-4" aria-hidden="true" />
							)}
						</button>
					</div>
				</div>

				{/* Submit Button */}
				<div className="pt-2">
					<Button
						type="submit"
						fullWidth
						className="min-h-11 text-sm font-bold shadow-md shadow-blue-600/20"
						disabled={loading || sessionLoading}
					>
						{loading ? (
							<span className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
								<span>Memverifikasi...</span>
							</span>
						) : (
							<span className="flex items-center gap-2">
								<span>Masuk ke Dashboard</span>
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</span>
						)}
					</Button>
				</div>
			</form>

			{/* Bottom Link for Public View */}
			<div className="mt-8 border-t border-slate-100 pt-5 text-center">
				<p className="text-xs text-slate-500">
					Masyarakat umum yang mencari informasi posko?{" "}
					<Link
						href="/public"
						className="font-bold text-blue-600 hover:text-blue-800 hover:underline transition"
					>
						Buka Informasi Publik
					</Link>
				</p>
			</div>
		</AuthLayout>
	);
}

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<AuthLayout>
					<div className="flex min-h-[22rem] items-center justify-center">
						<Loader2 className="h-7 w-7 animate-spin text-blue-600" aria-label="Memuat halaman..." />
					</div>
				</AuthLayout>
			}
		>
			<LoginForm />
		</Suspense>
	);
}
