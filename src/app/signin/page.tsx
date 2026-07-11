import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const demoMode = process.env.DEMO_MODE === "true";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.callbackUrl ?? "/evaluate";

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>ログイン</CardTitle>
          <CardDescription>
            {demoMode
              ? "デモモードではログインなしで評価を試せます。"
              : "GoogleアカウントでLIKEPASSに参加しましょう。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {demoMode && (
            <form
              action={async () => {
                "use server";
                await signIn("demo", { redirectTo });
              }}
            >
              <Button type="submit" className="w-full" size="lg">
                デモで試す（LIKE / PASS）
              </Button>
            </form>
          )}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <Button type="submit" className="w-full" size="lg" variant={demoMode ? "outline" : "default"}>
              Googleで続ける
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
