import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>ログイン</CardTitle>
          <CardDescription>GoogleアカウントでLIKEPASSに参加しましょう。</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: params.callbackUrl ?? "/evaluate" });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Googleで続ける
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
