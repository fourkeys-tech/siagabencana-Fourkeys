import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";

export const metadata: Metadata = {
	title: "Siaga Bencana",
	description: "Manajemen Bencana",
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
