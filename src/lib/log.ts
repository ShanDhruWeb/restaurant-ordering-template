// Structured JSON logs, one line per event. Secrets are redacted by key name.
// Never pass whole request bodies or payment payloads here: pick the fields you need.

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SECRET_KEY = /secret|signature|password|token|authorization|cookie|key_?id/i;

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SECRET_KEY.test(k)) out[k] = "[redacted]";
    else if (v instanceof Error) out[k] = { name: v.name, message: v.message, stack: v.stack };
    else out[k] = v;
  }
  return out;
}

function write(level: Level, msg: string, fields: Fields = {}): void {
  if (process.env.VITEST && process.env.LOG_IN_TESTS !== "true") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...redact(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  // eslint-disable-next-line no-console -- this IS the logger
  else console.log(line);
}

export const log = {
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};
