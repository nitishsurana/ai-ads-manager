import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createCookieClient } from "@/lib/db";
import {
  ADMIN_COOKIE,
  TESTER_COOKIE,
  verifyAdminCookie,
  verifyTesterCookie,
} from "./cookies";

export const getTester = cache(async () => {
  const cookieStore = await cookies();
  const payload = await verifyTesterCookie(
    cookieStore.get(TESTER_COOKIE)?.value,
  );
  if (!payload) return null;

  const supabase = await createCookieClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.sub !== payload.uid) return null;

  return { userId: payload.uid, name: payload.name };
});

export async function requireTester() {
  const tester = await getTester();
  if (!tester) redirect("/sign-in");
  return tester;
}

export async function isAdmin() {
  const cookieStore = await cookies();
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/sign-in");
}
