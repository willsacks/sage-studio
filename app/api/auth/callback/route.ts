import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/my-site";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Collect cookies to set so we can attach them to whichever response we return
  const pendingCookies: Parameters<typeof response.cookies.set>[] = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            pendingCookies.push([name, value, options])
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  let redirectTo = `${origin}${next}`;

  if (error) {
    redirectTo = `${origin}/login?error=auth_failed`;
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_done")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.onboarding_done) {
        redirectTo = `${origin}/onboarding`;
      }
    }
  }

  const response = NextResponse.redirect(redirectTo);
  pendingCookies.forEach((args) => response.cookies.set(...args));
  return response;
}
