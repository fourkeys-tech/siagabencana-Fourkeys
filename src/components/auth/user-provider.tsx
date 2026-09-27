"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type { SessionUser } from "@/lib/navigation";

type AuthContextValue = {
	user: SessionUser | null;
	loading: boolean;
	refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
	user: null,
	loading: true,
	refresh: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<SessionUser | null>(null);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(() => {
		return fetch("/api/auth/me", { cache: "no-store" })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				setUser(data?.success && data.user ? data.user : null);
			})
			.catch(() => {
				setUser(null);
			})
			.finally(() => {
				setLoading(false);
			});
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return (
		<AuthContext.Provider value={{ user, loading, refresh }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useSession() {
	return useContext(AuthContext);
}
