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
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/ranking" className="hover:underline">
            ランキング
          </Link>
          {session?.user ? (
            <>
              <Link href="/evaluate" className="hover:underline">
                評価
              </Link>
              <Link href="/upload" className="hover:underline">
                投稿
              </Link>
              <Link href="/me" className="hover:underline">
                マイページ
              </Link>
              <form action="/api/auth/signout" method="POST">
                <Button type="submit" variant="ghost" size="sm">
                  ログアウト
                </Button>
              </form>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/signin">ログイン</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
