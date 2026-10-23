// POST /api/admin/logout
import { route } from "@/lib/http";
import { assertSameOrigin } from "@/server/admin/guard";
import { clearSessionCookie } from "@/server/admin/session";

export const dynamic = "force-dynamic";

export const POST = route("admin.logout", async (request) => {
  assertSameOrigin(request);
  await clearSessionCookie();
  return Response.json({ ok: true });
});
