"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/ranking", label: "ランキング", match: (path: string) => path.startsWith("/ranking") },
  { href: "/evaluate", label: "評価", match: (path: string) => path.startsWith("/evaluate") },
  { href: "/upload", label: "投稿", match: (path: string) => path.startsWith("/upload") },
  { href: "/me", label: "マイページ", match: (path: string) => path.startsWith("/me") },
] as const;

export function GlobalNavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="container mx-auto px-0">
        <div className="grid grid-cols-4 w-full">
          {NAV_ITEMS.map((item) => {
            const isActive = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-center py-3 text-sm font-medium text-center transition-colors border-b-2",
                  isActive
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
