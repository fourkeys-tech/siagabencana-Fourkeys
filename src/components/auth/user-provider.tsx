"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type { SessionUser } from "@/lib/navigation";
import { setUnauthorizedHandler } from "@/lib/api-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error" | "expired";

type AuthContextValue = {
	user: SessionUser | null;
	loading: boolean;
	status: AuthStatus;
	refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
	user: null,
	loading: true,
	status: "loading",
	refresh: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<SessionUser | null>(null);
	const [status, setStatus] = useState<AuthStatus>("loading");
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		try {
			const response = await fetch("/api/auth/me", { cache: "no-store" });
			if (response.status === 401) {
				const data = await response.json().catch(() => null);
				setUser(null);
				setStatus(data?.code === "SESSION_EXPIRED" ? "expired" : "unauthenticated");
				return;
			}
			if (!response.ok) {
				setStatus((current) => current === "authenticated" ? current : "error");
				return;
			}
			const data = await response.json();
			if (data?.success && data.user) {
				setUser(data.user);
				setStatus("authenticated");
			} else {
				setUser(null);
				setStatus("unauthenticated");
			}
		} catch {
			setStatus((current) => current === "authenticated" ? current : "error");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		setUnauthorizedHandler(() => {
			setUser(null);
			setStatus("expired");
		});
		const timer = window.setTimeout(() => {
			void refresh();
		}, 0);
		return () => {
			setUnauthorizedHandler(null);
			window.clearTimeout(timer);
		};
	}, [refresh]);

	return (
		<AuthContext.Provider value={{ user, loading, status, refresh }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useSession() {
	return useContext(AuthContext);
}