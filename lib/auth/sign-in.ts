import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { createCookieClient, createSecretClient } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { MessageCode } from "@/lib/messages";
import { createAdminCookie, createTesterCookie } from "./cookies";
import { passwordMatches } from "./password";

export type SignInFailure = { ok: false; code: MessageCode };
type SignInResult = { ok: true } | SignInFailure;

const testerInput = z.object({
  name: z.string().trim().min(1).max(40),
  password: z.string().min(1),
});

export async function signInTester(input: {
  name: string;
  password: string;
}): Promise<SignInResult> {
  const parsed = testerInput.safeParse(input);
  if (!parsed.success) {
    const nameInvalid = parsed.error.issues.some((i) => i.path[0] === "name");
    return { ok: false, code: nameInvalid ? "name_invalid" : "wrong_password" };
  }
  const { name, password } = parsed.data;
  if (!passwordMatches(password, getEnv().TESTER_PASSWORD)) {
    return { ok: false, code: "wrong_password" };
  }

  const supabase = await createCookieClient();
  // getUser asks the Auth server, so a session whose user was deleted isn't reused.
  const { data: existing } = await supabase.auth.getUser();
  let userId = existing.user?.id;
  if (!userId) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user)
      throw error ?? new Error("Anonymous sign-in failed");
    userId = data.user.id;
  }

  const { error } = await createSecretClient()
    .from("testers")
    .upsert({ user_id: userId, name }, { onConflict: "user_id" });
  if (error) throw error;

  const cookie = await createTesterCookie(userId, name);
  (await cookies()).set(cookie.name, cookie.value, cookie.options);
  return { ok: true };
}

export async function signInAdmin(password: string): Promise<SignInResult> {
  if (!password || !passwordMatches(password, getEnv().ADMIN_PASSWORD)) {
    return { ok: false, code: "wrong_password" };
  }

  const cookie = await createAdminCookie();
  (await cookies()).set(cookie.name, cookie.value, cookie.options);
  return { ok: true };
}

const LOCAL_ORIGIN = "http://local.invalid";

// Parse rather than prefix-match: URL parsing strips tabs and newlines, so "/\t/evil.com" becomes "//evil.com".
export function safeNextPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  const url = URL.parse(value, LOCAL_ORIGIN);
  if (url?.origin !== LOCAL_ORIGIN) return "/";
  const path = url.pathname + url.search;
  // Dot segments collapse after parsing, so "/.//evil.com" comes back as "//evil.com".
  return path.startsWith("//") ? "/" : path;
}
