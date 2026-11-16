import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  TESTER_COOKIE,
  verifyAdminCookie,
  verifyTesterCookie,
} from "@/lib/auth";
import { getEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/sign-in", "/admin/sign-in"];

export async function proxy(request: NextRequest) {
  const env = getEnv();
  let supabaseResponse = NextResponse.next({ request });
  let authHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          authHeaders = headers;
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  // A refreshed session must survive on every response, including redirects.
  const withSession = (response: NextResponse) => {
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => response.cookies.set(cookie));
    Object.entries(authHeaders).forEach(([key, value]) =>
      response.headers.set(key, value),
    );
    return response;
  };

  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/cron/")) {
    return supabaseResponse;
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const isAdmin = await verifyAdminCookie(
      request.cookies.get(ADMIN_COOKIE)?.value,
    );
    return isAdmin
      ? supabaseResponse
      : withSession(
          NextResponse.redirect(new URL("/admin/sign-in", request.url)),
        );
  }

  const tester = await verifyTesterCookie(
    request.cookies.get(TESTER_COOKIE)?.value,
  );
  if (tester && data?.claims.sub === tester.uid) return supabaseResponse;

  if (pathname.startsWith("/api/")) {
    return withSession(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );
  }
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", pathname + search);
  return withSession(NextResponse.redirect(signIn));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|\\.well-known/workflow/).*)",
  ],
};
