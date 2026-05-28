import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const STUDIO_HOSTNAMES = ["sagestudio.org", "localhost"];

function isStudioHost(hostname: string) {
  return STUDIO_HOSTNAMES.some(
    (h) => hostname === h || hostname.endsWith(`.${h}`)
  );
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const rawHostname = (request.headers.get("host") ?? "").split(":")[0];
  const hostname = rawHostname.startsWith("www.") ? rawHostname.slice(4) : rawHostname;
  const { pathname } = request.nextUrl;

  // Custom domain routing for Pro artist sites — runs before auth
  if (!isStudioHost(hostname)) {
    const { data: site } = await supabase
      .from("artist_sites")
      .select("slug")
      .eq("custom_domain", hostname)
      .eq("custom_domain_verified", true)
      .eq("is_published", true)
      .single();

    if (site) {
      const slugPrefix = `/sites/${site.slug}`;
      const effectivePath = pathname.startsWith(`${slugPrefix}/`)
        ? pathname.slice(slugPrefix.length)
        : pathname;
      const rewritePath = `/sites/${site.slug}${effectivePath === "/" ? "" : effectivePath}`;
      const url = request.nextUrl.clone();
      url.pathname = rewritePath;
      return NextResponse.rewrite(url);
    }

    return supabaseResponse;
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/my-site", request.url));
  }

  const isProtected =
    pathname.startsWith("/my-site") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/my-templates") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin");

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
