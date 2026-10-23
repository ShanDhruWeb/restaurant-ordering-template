// The ONE place admin access is checked. Every admin page calls requireAdminPage()
// and every admin API route is wrapped in adminRoute().
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { type HandlerContext, HttpError, route } from "@/lib/http";
import { readSessionToken, SESSION_COOKIE } from "./session";

export interface Admin {
  id: string;
  email: string;
}

/** The logged-in admin, or null. Checks the token AND that the account still matches. */
export async function currentAdmin(): Promise<Admin | null> {
  const claims = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const admin = await prisma.adminUser.findUnique({
    where: { id: claims.adminId },
    select: { id: true, email: true, sessionVersion: true },
  });
  if (!admin || admin.sessionVersion !== claims.version) return null;
  return { id: admin.id, email: admin.email };
}

/** For admin pages: redirects to the login page when not logged in. */
export async function requireAdminPage(): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/**
 * CSRF protection for cookie-authenticated requests: SameSite=Lax cookies plus a
 * same-origin check. Browsers always send Origin on POST/PATCH/DELETE.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new HttpError(403, "Forbidden.", "bad_origin");
  const env = getEnv();
  const allowed = new Set([new URL(env.siteUrl).origin]);
  const host = request.headers.get("host");
  if (host) {
    // The host this request was sent to (covers preview deployments and LAN testing).
    allowed.add(`https://${host}`);
    if (env.nodeEnv !== "production") allowed.add(`http://${host}`);
  }
  if (!allowed.has(origin)) throw new HttpError(403, "Forbidden.", "bad_origin");
}

type AdminHandler<P> = (
  request: Request,
  ctx: HandlerContext & { admin: Admin },
  routeArg: P,
) => Promise<Response>;

/** Wrap an admin API route: session required; changes need JSON and the same origin. */
export function adminRoute<P extends { params: Promise<Record<string, string>> }>(
  name: string,
  fn: AdminHandler<P>,
) {
  return route<P>(name, async (request, ctx, routeArg) => {
    const admin = await currentAdmin();
    if (!admin) throw new HttpError(401, "Please log in again.", "unauthorised");
    if (request.method !== "GET") {
      assertSameOrigin(request);
      const type = request.headers.get("content-type") ?? "";
      if (!type.toLowerCase().startsWith("application/json")) {
        throw new HttpError(415, "Expected a JSON request.", "unsupported_media_type");
      }
    }
    return fn(request, { ...ctx, admin }, routeArg);
  });
}
