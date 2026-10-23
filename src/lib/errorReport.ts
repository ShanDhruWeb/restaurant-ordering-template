// Optional error reporting to Sentry. Only active when SENTRY_DSN is set.
// Uses Sentry's plain HTTP envelope endpoint so we do not need the large SDK.
// Sends the error name, message and stack only: never request bodies or secrets.
import "server-only";
import { randomUUID } from "node:crypto";

export function reportError(err: unknown, tags: Record<string, string> = {}): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/\//g, "");
    const publicKey = url.username;
    const endpoint = `${url.protocol}//${url.host}/api/${projectId}/envelope/`;
    const error = err instanceof Error ? err : new Error(String(err));
    const eventId = randomUUID().replace(/-/g, "");
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: "node",
      level: "error",
      release: process.env.npm_package_version,
      tags,
      exception: { values: [{ type: error.name, value: error.message, stacktrace: undefined }] },
      extra: { stack: error.stack },
    };
    const body = [
      JSON.stringify({ event_id: eventId, dsn }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event),
    ].join("\n");
    void fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=restaurant-template/1`,
      },
      body,
    }).catch(() => undefined);
  } catch {
    // Reporting must never break the request.
  }
}
