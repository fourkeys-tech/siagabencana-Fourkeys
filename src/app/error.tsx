"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("APP_ERROR", error);
	}, [error]);

	return (
		<div className="min-h-screen flex items-center justify-center px-4 py-10">
			<div className="max-w-md text-center space-y-5">
				<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
					<AlertTriangle size={26} />
				</div>
				<div>
					<h1 className="text-2xl font-bold text-slate-950">Terjadi kesalahan</h1>
					<p className="mt-2 text-sm text-slate-500">
						Aplikasi gagal memuat halaman ini. Silakan coba lagi, atau hubungi administrator bila masalah berlanjut.
					</p>
					{error.digest && (
						<p className="mt-3 font-mono text-[10px] text-slate-400">Ref: {error.digest}</p>
					)}
				</div>
				<div className="flex justify-center gap-2">
					<Button onClick={() => reset()}>Coba lagi</Button>
					<Link href="/dashboard">
						<Button variant="secondary">Kembali ke Dashboard</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}