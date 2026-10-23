// POST /api/admin/login: email + password -> session cookie.
import { HttpError, readJson, route } from "@/lib/http";
import { assertSameOrigin } from "@/server/admin/guard";
import { login, loginSchema } from "@/server/admin/login";

export const dynamic = "force-dynamic";

export const POST = route("admin.login", async (request, ctx) => {
  assertSameOrigin(request);
  const input = await readJson(request, loginSchema);
  if (!input.email || !input.password)
    throw new HttpError(400, "Enter your email and password.", "invalid_request");
  await login(input, ctx.ip);
  return Response.json({ ok: true });
});
