import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertCircle, Leaf } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/lib/actions/site-collaborators";

export const metadata: Metadata = { title: "Accept Invite" };

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const result = await acceptInvite(token);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm space-y-8">
        <Link href="/" className="flex items-center gap-2 justify-center">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Leaf size={16} className="text-[var(--primary-foreground)]" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Sage Studio</span>
        </Link>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 space-y-4 text-center">
          {"error" in result ? (
            <>
              <AlertCircle size={28} className="text-red-500 mx-auto" />
              <p className="text-sm font-medium">{result.error}</p>
              <Link href="/my-site" className="inline-block text-sm font-medium text-[var(--primary)] hover:underline">
                Go to Sites
              </Link>
            </>
          ) : (
            <>
              <CheckCircle2 size={28} className="text-emerald-500 mx-auto" />
              <p className="text-sm font-medium">
                You now have <span className="capitalize">{result.role}</span> access to {result.siteName}.
              </p>
              <Link
                href={`/my-site/${result.siteId}`}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Open {result.siteName}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
