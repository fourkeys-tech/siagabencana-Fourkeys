import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
	return (
		<div className="min-h-screen flex items-center justify-center px-4 py-10">
			<div className="max-w-md text-center space-y-5">
				<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
					<Compass size={26} />
				</div>
				<div>
					<h1 className="text-2xl font-bold text-slate-950">Halaman tidak ditemukan</h1>
					<p className="mt-2 text-sm text-slate-500">
						Tautan yang Anda ikuti mungkin rusak, atau halaman telah dipindahkan.
					</p>
				</div>
				<div className="flex justify-center gap-2">
					<Link href="/public">
						<Button>Halaman Publik</Button>
					</Link>
					<Link href="/dashboard">
						<Button variant="secondary">Dashboard</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}