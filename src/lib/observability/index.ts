import { randomUUID } from "crypto";

export function logEvent(event: string, properties?: Record<string, unknown>) {
  const payload = { event, ...properties, ts: new Date().toISOString() };
  if (process.env.NODE_ENV === "development") {
    console.log(JSON.stringify(payload));
  }
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(JSON.stringify({ error: message, stack, ...context, ts: new Date().toISOString() }));

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
    if (!match) return;

    const [, key, host, projectId] = match;
    const envelope = {
      event_id: randomUUID().replace(/-/g, ""),
      timestamp: Date.now() / 1000,
      platform: "node",
      level: "error",
      message,
      extra: context,
    };

    void fetch(`https://${host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}, sentry_client=likepass/1.0`,
      },
      body: JSON.stringify({ event: envelope }),
    }).catch(() => {});
  } catch {
    // Sentry forwarding is best-effort
  }
}
