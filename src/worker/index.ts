import { startWorker } from "@/lib/jobs/handlers";

startWorker().catch((err) => {
  console.error("Worker failed to start:", err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
