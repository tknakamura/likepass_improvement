import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function MeSubpageHeader({ title }: { title: string }) {
  return (
    <div className="mb-6">
      <Link
        href="/me"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-3"
      >
        <ChevronLeft className="h-4 w-4" />
        マイページ
      </Link>
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  );
}
