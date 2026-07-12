import PgBoss from "pg-boss";

export const JOB_QUEUE_NAMES = ["process_image", "recalculate_ranking"] as const;

let boss: PgBoss | null = null;

function getPgBossOptions(): string | ConstructorParameters<typeof PgBoss>[0] {
  const url = process.env.DATABASE_URL;
  if (!url) return url!;

  // Render Postgres requires TLS; pg-boss uses node-pg directly (unlike Prisma).
  if (process.env.NODE_ENV === "production" || url.includes("render.com")) {
    return {
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    };
  }

  return url;
}

async function ensureJobQueues(instance: PgBoss) {
  for (const name of JOB_QUEUE_NAMES) {
    await instance.createQueue(name);
  }
}

export async function getBoss(): Promise<PgBoss | null> {
  if (!process.env.DATABASE_URL) return null;
  if (!boss) {
    boss = new PgBoss(getPgBossOptions());
    await boss.start();
    await ensureJobQueues(boss);
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
