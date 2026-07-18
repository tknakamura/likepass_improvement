import { auth } from "@/lib/auth";
import { GlobalNavBar } from "@/components/layout/global-nav-bar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";

export async function GlobalNav() {
  const session = await auth();
  if (!session?.user) return null;
  return (
    <>
      <GlobalNavBar />
      <BottomTabBar />
    </>
  );
}
