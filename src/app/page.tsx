import Link from "next/link";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const demoMode = process.env.DEMO_MODE === "true";

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <section className="text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">LIKEPASS</h1>
        <p className="text-xl text-[var(--muted-foreground)]">
          素敵な画像を、みんなの審美眼で見つける。
        </p>
        <p className="text-[var(--muted-foreground)] max-w-2xl mx-auto">
          写真に LIKE または PASS の二択で評価。AIが付けたタグごとにランキングが形成され、
          評価に参加することで順位の写真が開放されます。
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          {demoMode ? (
            <form
              action={async () => {
                "use server";
                await signIn("demo", { redirectTo: "/evaluate" });
              }}
            >
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                デモで評価を試す
              </Button>
            </form>
          ) : (
            <Button asChild size="lg">
              <Link href="/signin">Googleで続ける</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link href="/ranking">ランキングを見る</Link>
          </Button>
        </div>
      </section>

      <section className="mt-20 grid md:grid-cols-3 gap-8">
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="font-semibold text-lg mb-2">LIKE</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            このランキングに残したい写真に投票します。
          </p>
        </div>
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="font-semibold text-lg mb-2">PASS</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            今回は見送る。品質向上への投票としてカウントされます。
          </p>
        </div>
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="font-semibold text-lg mb-2">ランキング開放</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            評価すると、マスクされた順位の写真が見られるようになります。
          </p>
        </div>
      </section>
    </div>
  );
}
