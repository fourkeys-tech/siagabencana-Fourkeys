import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";

export const metadata: Metadata = {
	title: "SIANA - Sistem Informasi dan Manajemen Bencana",
	description: "Informasi publik posko evakuasi, kapasitas, fasilitas, dan bantuan bencana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="id" className="h-full antialiased" suppressHydrationWarning>
			<body className="min-h-full flex flex-col" suppressHydrationWarning>
				<LayoutWrapper>{children}</LayoutWrapper>
			</body>
		</html>
	);
}
