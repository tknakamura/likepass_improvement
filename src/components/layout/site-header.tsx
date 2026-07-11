import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">
          LIKEPASS
        </Link>
        <div className="flex items-center gap-2">
          {session?.user ? (
            <form action="/api/auth/signout" method="POST">
              <Button type="submit" variant="ghost" size="sm">
                ログアウト
              </Button>
            </form>
          ) : (
            <Button asChild size="sm">
              <Link href="/signin">ログイン</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
