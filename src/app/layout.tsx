import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";

export const metadata: Metadata = {
	title: "SIANA | Sistem Informasi Manajemen Bencana",
	description: "SIANA adalah sistem informasi manajemen bencana yang digunakan untuk membantu dalam pengelolaan dan koordinasi kegiatan penanganan bencana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="h-full antialiased" suppressHydrationWarning>
			<body className="min-h-full flex flex-col" suppressHydrationWarning>
				<LayoutWrapper>{children}</LayoutWrapper>
			</body>
		</html>
	);
}
