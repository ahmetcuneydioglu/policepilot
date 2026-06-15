import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that never require authentication
// /davet: davet/şifre-belirleme — kullanıcı henüz oturumsuz gelir (token URL hash'inde),
//         proxy engellerse hash kaybolur ve davet akışı kırılır.
const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/davet"]);
const PUBLIC_PREFIXES = ["/teklif-al", "/a/", "/_next", "/api", "/favicon"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Always allow public paths ────────────────────────────────────────────
  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // ── Build a mutable response so we can forward refreshed auth cookies ────
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Forward refreshed cookies to both the outgoing request and response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ── Validate the session (network call to Supabase Auth — secure) ─────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Not authenticated → /login (carry intended destination) ──────────────
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/login") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── super_admin-only routes ───────────────────────────────────────────────
  const SUPER_ADMIN_PREFIXES = ["/leads", "/agencies"];
  if (SUPER_ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    const role = (user.app_metadata as Record<string, string> | undefined)
      ?.role;
    if (role !== "super_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets and Next.js internals
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
