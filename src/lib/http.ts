// Shared plumbing for API route handlers: request ids, JSON body parsing with size
// limits and zod validation, and generic error responses.
// Clients never see internal error messages, only { error, requestId }.
import "server-only";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { log } from "./log";
import { reportError } from "./errorReport";

/** An error whose message is safe to show to the client. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "error",
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export interface HandlerContext {
  requestId: string;
  ip: string;
}

type RouteParams = { params: Promise<Record<string, string>> };
type Handler<P extends RouteParams> = (request: Request, ctx: HandlerContext, route: P) => Promise<Response>;

export function clientIp(request: Request): string {
  // Vercel and most proxies set x-forwarded-for; the first entry is the client.
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

/** Wrap a route handler with logging, a request id and safe error handling. */
export function route<P extends RouteParams = RouteParams>(name: string, fn: Handler<P>) {
  return async (request: Request, routeArg: P): Promise<Response> => {
    const requestId = randomUUID();
    const started = Date.now();
    const ctx: HandlerContext = { requestId, ip: clientIp(request) };
    let response: Response;
    try {
      response = await fn(request, ctx, routeArg);
    } catch (err) {
      response = errorResponse(err, requestId, name);
    }
    response.headers.set("x-request-id", requestId);
    response.headers.set("cache-control", "no-store");
    log.info("api", {
      route: name,
      method: request.method,
      status: response.status,
      ms: Date.now() - started,
      requestId,
    });
    return response;
  };
}

function errorResponse(err: unknown, requestId: string, routeName: string): Response {
  if (err instanceof HttpError) {
    return Response.json(
      { error: err.message, code: err.code, requestId, ...err.extra },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return Response.json(
      {
        error: "Some details are missing or invalid.",
        code: "invalid_request",
        requestId,
        fields: err.issues.map((i) => i.path.join(".")).filter(Boolean),
      },
      { status: 400 },
    );
  }
  log.error("unhandled error", { route: routeName, requestId, err });
  reportError(err, { route: routeName, requestId });
  return Response.json({ error: "Something went wrong", requestId }, { status: 500 });
}

export const MAX_JSON_BYTES = 16 * 1024;

/** Read a JSON body: requires application/json, enforces a size limit, validates with zod. */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes = MAX_JSON_BYTES,
): Promise<z.output<S>> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Expected a JSON request.", "unsupported_media_type");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "Request is too large.", "too_large");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes)
    throw new HttpError(413, "Request is too large.", "too_large");
  let data: unknown;
  try {
    data = text.length === 0 ? {} : JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body is not valid JSON.", "invalid_json");
  }
  return schema.parse(data);
}

/** Route params validated with zod, e.g. an order id. */
export async function readParams<S extends z.ZodType>(route: RouteParams, schema: S): Promise<z.output<S>> {
  const result = schema.safeParse(await route.params);
  if (!result.success) throw new HttpError(404, "Not found.", "not_found");
  return result.data;
}

export const orderIdParam = z.object({ id: z.string().regex(/^[a-z0-9]{20,40}$/) }).strict();
