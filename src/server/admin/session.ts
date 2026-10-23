// Staff sessions: a signed JWT (HS256, jose) in an httpOnly, Secure, SameSite=Lax cookie.
// The token carries the admin id and sessionVersion; resetting a password bumps
// the version, which logs out every old session.
import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = "admin_session";
const SESSION_HOURS = 12;

export interface SessionClaims {
  adminId: string;
  email: string;
  version: number;
}

function key() {
  return new TextEncoder().encode(getEnv().sessionSecret);
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, v: claims.version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.adminId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function readSessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.v !== "number"
    ) {
      return null;
    }
    return { adminId: payload.sub, email: payload.email, version: payload.v };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
