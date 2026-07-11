import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] mt-auto">
      <div className="container mx-auto px-4 py-8 flex flex-wrap gap-4 text-sm text-[var(--muted-foreground)]">
        <Link href="/terms" className="hover:underline">
          利用規約
        </Link>
        <Link href="/privacy" className="hover:underline">
          プライバシーポリシー
        </Link>
        <Link href="/guidelines" className="hover:underline">
          コミュニティガイドライン
        </Link>
        <span className="ml-auto">© LIKEPASS</span>
      </div>
    </footer>
  );
}
