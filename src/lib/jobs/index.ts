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
  const processInline =
    process.env.DEMO_MODE === "true" ||
    process.env.PROCESS_JOBS_INLINE === "true" ||
    process.env.NODE_ENV === "development";

  if (processInline) {
    const { processJobInline } = await import("@/lib/jobs/handlers");
    await processJobInline(name, data);
    return;
  }

  const b = await getBoss();
  if (!b) {
    const { processJobInline } = await import("@/lib/jobs/handlers");
    await processJobInline(name, data);
    return;
  }
  await b.send(name, data);
}
