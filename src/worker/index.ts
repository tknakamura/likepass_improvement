import { startWorker } from "@/lib/jobs/handlers";

startWorker().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
