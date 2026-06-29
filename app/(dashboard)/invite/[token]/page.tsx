import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
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
    <div className="max-w-md mx-auto py-12">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 space-y-4 text-center">
        {"error" in result ? (
          <>
            <AlertCircle size={28} className="text-red-500 mx-auto" />
            <p className="text-sm font-medium">{result.error}</p>
            <Link href="/my-site" className="inline-block text-sm font-medium text-[var(--primary)] hover:underline">
              Go to My Websites
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
  );
}
