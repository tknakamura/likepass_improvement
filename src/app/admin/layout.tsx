import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const NAV = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/contents", label: "投稿" },
  { href: "/admin/reports", label: "通報" },
  { href: "/admin/users", label: "ユーザー" },
  { href: "/admin/tags", label: "タグ" },
  { href: "/admin/rankings", label: "ランキング" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">管理画面</h1>
      <nav className="flex flex-wrap gap-2 mb-6">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border)] hover:bg-[var(--muted)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
