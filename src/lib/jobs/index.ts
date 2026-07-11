import PgBoss from "pg-boss";

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss | null> {
  if (!process.env.DATABASE_URL) return null;
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL);
    await boss.start();
  }
  return boss;
}

export async function enqueueJob(name: string, data: Record<string, unknown>) {
  const b = await getBoss();
  if (!b) {
    if (process.env.NODE_ENV === "development") {
      const { processJobInline } = await import("@/lib/jobs/handlers");
      await processJobInline(name, data);
    }
    return;
  }
  await b.send(name, data);
}
