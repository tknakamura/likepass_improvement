import { auth } from "@/lib/auth";
import { GlobalNavBar } from "@/components/layout/global-nav-bar";

export async function GlobalNav() {
  const session = await auth();
  if (!session?.user) return null;
  return <GlobalNavBar />;
}
