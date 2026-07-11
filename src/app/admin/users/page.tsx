import { prisma } from "@/lib/db";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      username: true,
      email: true,
      status: true,
      role: true,
      createdAt: true,
      _count: { select: { contents: true, votes: true } },
    },
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">ユーザー一覧</h2>
      {users.map((u) => (
        <div key={u.id} className="p-3 border border-[var(--border)] rounded-lg text-sm">
          <p className="font-medium">@{u.username ?? "—"} · {u.role}</p>
          <p className="text-[var(--muted-foreground)]">
            {u.email} · {u.status} · 投稿 {u._count.contents} · 評価 {u._count.votes}
          </p>
        </div>
      ))}
    </div>
  );
}
