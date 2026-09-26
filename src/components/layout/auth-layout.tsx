export function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
			<div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
				{children}
			</div>
		</div>
	);
}
