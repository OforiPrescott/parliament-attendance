import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PAGES = ["/login"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * 1. CSRF: state-changing API calls must come from this application's own
 *    origin. Combined with SameSite=Strict session cookies this blocks
 *    cross-site request forgery.
 * 2. Pages without a session cookie are sent to /login. (Full session
 *    validation — expiry, idle timeout, revocation — happens server-side
 *    on every page and API call.)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    const allowed = new Set([req.nextUrl.origin, process.env.APP_ORIGIN].filter(Boolean) as string[]);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? req.nextUrl.protocol.replace(":", "");
    if (host) allowed.add(`${proto}://${host}`);
    if (!origin || !allowed.has(origin)) {
      return NextResponse.json({ error: "Request blocked: invalid origin." }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) return NextResponse.next();

  const hasSession = req.cookies.has("pa_session");
  if (!hasSession && !PUBLIC_PAGES.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|branding/).*)"],
};
