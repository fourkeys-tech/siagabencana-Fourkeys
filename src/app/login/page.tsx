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

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
			/>
			<path
				fill="#EA4335"
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
			/>
		</svg>
	);
}

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loading: sessionLoading, status, refresh } = useSession();
	const returnTo = safeReturnTo(searchParams.get("returnTo"));
	const errorParam = searchParams.get("error");
	const emailParam = searchParams.get("email");

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [googleLoading, setGoogleLoading] = useState(false);

	useEffect(() => {
		if (!sessionLoading && status === "authenticated" && user) {
			router.replace(returnTo);
		}
	}, [returnTo, router, sessionLoading, status, user]);

	useEffect(() => {
		if (errorParam) {
			const errorMessages: Record<string, string> = {
				unregistered: emailParam
					? `Akun Google (${emailParam}) belum terdaftar sebagai petugas di Siaga Bencana. Silakan hubungi Administrator.`
					: "Akun Google Anda belum terdaftar sebagai petugas di Siaga Bencana. Silakan hubungi Administrator.",
				google_cancelled: "Proses masuk dengan Google telah dibatalkan.",
				invalid_state: "Sesi login Google telah kedaluwarsa atau tidak valid. Silakan coba masuk kembali.",
				token_exchange_failed: "Gagal memverifikasi akun Google. Silakan periksa koneksi atau coba beberapa saat lagi.",
				email_not_verified: "Email akun Google Anda belum diverifikasi oleh Google.",
				not_configured: "Autentikasi Google belum dikonfigurasi. Pastikan GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET sudah diisi di .env.",
			};
			setError(errorMessages[errorParam] ?? "Terjadi kesalahan saat masuk dengan Google.");
		}
	}, [errorParam, emailParam]);

	const handleGoogleLogin = () => {
		if (googleLoading || loading || sessionLoading) return;
		setGoogleLoading(true);
		setError("");
		const target = returnTo
			? `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`
			: "/api/auth/google";
		window.location.href = target;
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (loading || googleLoading) return;

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
					className="flex items-center rounded-xl bg-[#0b1730] px-3.5 py-2 shadow-sm"
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
			<div className="mb-6">
				<h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
					Selamat Datang
				</h1>
				<p className="mt-2 text-sm leading-relaxed text-slate-500">
					Masuk untuk mengakses command center dan pengelolaan operasional Siaga Bencana.
				</p>
			</div>

			{/* Error Message */}
			{error && (
				<div id="login-error" role="alert" className="mb-5 animate-in fade-in duration-200">
					<Alert type="error">{error}</Alert>
				</div>
			)}

			{/* Google Sign-in Button */}
			<button
				type="button"
				onClick={handleGoogleLogin}
				disabled={googleLoading || loading || sessionLoading}
				className="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{googleLoading ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden="true" />
						<span>Menghubungkan ke Google...</span>
					</>
				) : (
					<>
						<GoogleIcon className="h-4 w-4" />
						<span>Masuk dengan Google</span>
					</>
				)}
			</button>

			{/* Divider */}
			<div className="relative my-5 flex items-center justify-center">
				<div className="w-full border-t border-slate-200" />
				<span className="absolute bg-white px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
					atau dengan email
				</span>
			</div>

			{/* Form */}
			<form onSubmit={handleSubmit} className="space-y-4">
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
							disabled={loading || googleLoading || sessionLoading}
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
							disabled={loading || googleLoading || sessionLoading}
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
						disabled={loading || googleLoading || sessionLoading}
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
