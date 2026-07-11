export function logEvent(event: string, properties?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.log(JSON.stringify({ event, ...properties, ts: new Date().toISOString() }));
  }
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  console.error(JSON.stringify({ error: String(error), ...context, ts: new Date().toISOString() }));
}
