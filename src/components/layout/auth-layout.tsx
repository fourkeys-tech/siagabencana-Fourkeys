"use client";

import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Activity, Users, Truck } from "lucide-react";

/**
 * Latar belakang abstrak organik non-gradient dengan garis kontur topografi
 * menyerupai pemetaan medan bencana alam yang tidak beraturan.
 */
function AbstractContourBackground() {
	return (
		<svg
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
			xmlns="http://www.w3.org/2000/svg"
			preserveAspectRatio="none"
			viewBox="0 0 1200 900"
		>
			{/* Bidang daratan abstrak tidak beraturan (warna flat alami, non-gradient) */}
			<path
				d="M-100,-100 L480,-100 C430,90 350,170 270,230 C190,290 230,390 150,470 C70,550 -30,490 -100,530 Z"
				fill="#0e2246"
				fillOpacity="0.6"
			/>
			<path
				d="M1300,900 L840,900 C870,740 950,670 1020,590 C1090,510 1030,410 1130,330 C1210,250 1300,310 1300,270 Z"
				fill="#0e2246"
				fillOpacity="0.5"
			/>

			{/* Kurva kontur medan bergelombang tidak beraturan */}
			<path
				d="M-50,160 C130,110 270,280 450,200 C630,120 790,260 990,170 C1130,110 1260,210 1350,160"
				fill="none"
				stroke="#1e3a8a"
				strokeWidth="1.2"
				strokeOpacity="0.5"
			/>
			<path
				d="M-70,250 C100,200 240,360 420,280 C600,200 760,340 960,250 C1100,190 1230,290 1350,240"
				fill="none"
				stroke="#0284c7"
				strokeWidth="1"
				strokeOpacity="0.4"
			/>
			<path
				d="M-30,350 C150,300 290,460 470,380 C650,300 810,440 1010,350 C1150,290 1280,390 1350,340"
				fill="none"
				stroke="#38bdf8"
				strokeWidth="1.2"
				strokeOpacity="0.3"
			/>
			<path
				d="M-60,450 C120,400 260,560 440,480 C620,400 780,540 980,450 C1120,390 1250,490 1350,440"
				fill="none"
				stroke="#60a5fa"
				strokeWidth="1.5"
				strokeOpacity="0.25"
				strokeDasharray="8 8"
			/>
			<path
				d="M-20,550 C160,500 300,660 480,580 C660,500 820,640 1020,550 C1160,490 1290,590 1350,540"
				fill="none"
				stroke="#1e3a8a"
				strokeWidth="1"
				strokeOpacity="0.45"
			/>
			<path
				d="M-90,650 C90,600 230,760 410,680 C590,600 750,740 950,650 C1090,590 1220,690 1350,640"
				fill="none"
				stroke="#0284c7"
				strokeWidth="1.2"
				strokeOpacity="0.35"
			/>

			{/* Cincin kontur zona pulau/medan alami */}
			<path
				d="M190,610 C250,570 330,590 360,650 C390,710 340,780 270,790 C200,800 150,750 160,690 C170,640 150,630 190,610 Z"
				fill="#172e54"
				fillOpacity="0.2"
				stroke="#38bdf8"
				strokeWidth="1"
				strokeOpacity="0.4"
			/>
			<path
				d="M210,630 C250,600 310,610 330,660 C350,700 310,750 260,760 C210,770 170,730 180,680 Z"
				fill="none"
				stroke="#60a5fa"
				strokeWidth="0.8"
				strokeOpacity="0.4"
			/>

			<path
				d="M840,210 C910,170 990,200 1020,260 C1050,320 1010,390 940,400 C870,410 800,370 810,300 C820,250 800,230 840,210 Z"
				fill="#172e54"
				fillOpacity="0.2"
				stroke="#38bdf8"
				strokeWidth="1"
				strokeOpacity="0.35"
			/>
		</svg>
	);
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#070f1e] px-4 py-6 sm:px-6 sm:py-10">
			{/* Efek abstrak tidak beraturan tanpa gradien */}
			<AbstractContourBackground />

			{/* Card Container Tanpa Border Luar */}
			<div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/70 lg:grid-cols-[1.1fr_450px]">
				{/* Sisi Kiri: Branding & Ringkasan Komando Darurat (Desktop) dengan motif abstrak topografi */}
				<div className="hidden flex-col justify-between bg-[#0b1730] p-10 lg:p-12 text-white lg:flex relative overflow-hidden">
					{/* Kontur abstrak internal sisi kiri */}
					<svg
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 600 800"
						preserveAspectRatio="none"
					>
						<path
							d="M-20,110 C90,70 190,190 310,140 C430,90 510,210 630,150"
							fill="none"
							stroke="#60a5fa"
							strokeWidth="1.2"
						/>
						<path
							d="M-20,230 C110,180 210,300 330,250 C450,200 530,320 630,260"
							fill="none"
							stroke="#38bdf8"
							strokeWidth="1"
							strokeDasharray="6 6"
						/>
						<path
							d="M-20,370 C100,310 220,430 340,370 C460,310 540,440 630,380"
							fill="none"
							stroke="#93c5fd"
							strokeWidth="1.2"
						/>
						<path
							d="M-20,510 C120,450 230,570 350,500 C470,430 550,570 630,500"
							fill="none"
							stroke="#60a5fa"
							strokeWidth="1"
						/>
						<path
							d="M-20,650 C90,590 200,710 320,640 C440,570 520,700 630,630"
							fill="none"
							stroke="#38bdf8"
							strokeWidth="1.2"
						/>
						{/* Bentuk dataran tinggi organik abstrak */}
						<path
							d="M370,290 C430,250 510,270 540,340 C570,410 510,490 440,500 C370,510 310,450 320,380 C330,320 330,310 370,290 Z"
							fill="#142c54"
							fillOpacity="0.4"
							stroke="#60a5fa"
							strokeWidth="1"
						/>
					</svg>

					{/* Logo Header */}
					<div className="relative z-10">
						<Link
							href="/public"
							aria-label="Kembali ke Informasi Publik Siaga Bencana"
							className="inline-block transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 rounded-xl"
						>
							<Image
								src="/logo.svg"
								alt="Fourkeys Siaga Bencana"
								width={280}
								height={70}
								priority
								className="h-11 w-auto object-contain"
							/>
						</Link>
					</div>

					{/* Headline & Value Proposition */}
					<div className="relative z-10 my-auto space-y-6 py-8">
						<div className="inline-flex items-center gap-2 rounded-full bg-[#122347] px-3.5 py-1 text-xs font-semibold text-blue-200">
							<span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
							Pusat Komando & Operasi Bencana
						</div>

						<h1 className="text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight text-white">
							Satu pusat kendali respons bencana terpadu.
						</h1>

						<p className="text-sm leading-relaxed text-blue-100/75">
							Kelola posko evakuasi, shelter, logistik bantuan, dan data pengungsi secara cepat, akurat, dan transparan.
						</p>

						<div className="grid gap-3 pt-2">
							<div className="flex items-center gap-3 rounded-2xl bg-[#0f2142] p-3 text-xs text-blue-100/90">
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
									<Activity className="h-4 w-4" />
								</div>
								<span>Monitoring kapasitas & ketersediaan posko seketika</span>
							</div>
							<div className="flex items-center gap-3 rounded-2xl bg-[#0f2142] p-3 text-xs text-blue-100/90">
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
									<Users className="h-4 w-4" />
								</div>
								<span>Pencatatan data warga terdampak & kelompok rentan</span>
							</div>
							<div className="flex items-center gap-3 rounded-2xl bg-[#0f2142] p-3 text-xs text-blue-100/90">
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
									<Truck className="h-4 w-4" />
								</div>
								<span>Penyaluran logistik & bahan medis tepat sasaran</span>
							</div>
						</div>
					</div>

					{/* Footer status */}
					<div className="relative z-10 flex items-center justify-between text-xs text-blue-200/60 pt-6 border-t border-white/10">
						<span className="flex items-center gap-2">
							<ShieldCheck className="h-4 w-4 text-emerald-400" />
							Akses Terenkripsi & Terverifikasi
						</span>
						<Link
							href="/public"
							className="text-blue-300 hover:text-white transition font-medium"
						>
							Portal Publik →
						</Link>
					</div>
				</div>

				{/* Sisi Kanan: Konten Form Login */}
				<div className="min-w-0 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
					{children}
				</div>
			</div>
		</div>
	);
}
