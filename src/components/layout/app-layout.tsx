import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-gray-50">
			<Sidebar />
			<Header />
			<main className="ml-64 mt-16 p-6">
				{children}
			</main>
		</div>
	);
}
