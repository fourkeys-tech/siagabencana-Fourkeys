"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AuthGuard({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch("/api/auth/me", {
                    cache: "no-store",
                });

                if (!res.ok) {
                    router.replace("/login");
                    return;
                }

                const data = await res.json();

                if (!data.success || !data.user) {
                    router.replace("/login");
                    return;
                }

                setLoading(false);
            } catch {
                router.replace("/login");
            }
        };

        checkAuth();
    }, [router, pathname]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="text-gray-500">
                    Memuat...
                </span>
            </div>
        );
    }

    return <>{children}</>;
}