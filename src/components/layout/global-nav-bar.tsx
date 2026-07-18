"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";

export function GlobalNavBar() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:block border-b border-[var(--border)] bg-[var(--card)]">
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
