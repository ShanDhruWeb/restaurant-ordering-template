// Staff login. Rate limited per IP and per email, and every attempt is logged
// (without the password). The same message is shown for a wrong email or a wrong
// password, so the form does not reveal which emails exist.
import "server-only";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { log } from "@/lib/log";
import { enforce, LIMITS } from "../rateLimit";
import { createSessionToken, setSessionCookie } from "./session";

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(200),
    password: z.string().min(1).max(200),
  })
  .strict();

// Unknown emails are checked against a throwaway hash so they take as long as
// known ones (no timing hint about which emails exist).
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash(randomUUID(), 12));

export async function login(input: z.infer<typeof loginSchema>, ip: string): Promise<void> {
  await enforce("login-ip", ip, LIMITS.login);
  await enforce("login-email", input.email, LIMITS.loginEmail);

  const admin = await prisma.adminUser.findUnique({ where: { email: input.email } });
  const ok = await bcrypt.compare(input.password, admin?.passwordHash ?? (await getDummyHash()));
  if (!admin || !ok) {
    log.warn("admin login failed", { email: input.email, ip });
    throw new HttpError(401, "Wrong email or password.", "invalid_credentials");
  }
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await setSessionCookie(
    await createSessionToken({ adminId: admin.id, email: admin.email, version: admin.sessionVersion }),
  );
  log.info("admin login", { email: admin.email, ip });
}
