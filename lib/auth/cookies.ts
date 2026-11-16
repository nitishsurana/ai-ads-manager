import "server-only";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { signToken, verifyToken } from "./token";

export const TESTER_COOKIE = "tester";
export const ADMIN_COOKIE = "admin";

const TESTER_TTL_S = 30 * 24 * 60 * 60;
const ADMIN_TTL_S = 12 * 60 * 60;

const testerPayload = z.object({
  uid: z.string(),
  name: z.string(),
  exp: z.number(),
});
const adminPayload = z.object({ role: z.literal("admin"), exp: z.number() });

function expiresIn(ttlSeconds: number) {
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

function options(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  } as const;
}

export async function createTesterCookie(uid: string, name: string) {
  const value = await signToken(
    { uid, name, exp: expiresIn(TESTER_TTL_S) },
    getEnv().SESSION_SECRET,
  );
  return { name: TESTER_COOKIE, value, options: options(TESTER_TTL_S) };
}

export async function createAdminCookie() {
  const value = await signToken(
    { role: "admin", exp: expiresIn(ADMIN_TTL_S) },
    getEnv().SESSION_SECRET,
  );
  return { name: ADMIN_COOKIE, value, options: options(ADMIN_TTL_S) };
}

export function verifyTesterCookie(value: string | undefined) {
  return verifyToken(value, testerPayload, getEnv().SESSION_SECRET);
}

export async function verifyAdminCookie(value: string | undefined) {
  return (
    (await verifyToken(value, adminPayload, getEnv().SESSION_SECRET)) !== null
  );
}
