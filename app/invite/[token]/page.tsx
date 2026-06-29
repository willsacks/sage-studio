import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Leaf, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/lib/actions/site-collaborators";
import { getInvitePreview } from "@/lib/queries/site-collaborators";

export const metadata: Metadata = { title: "Accept Invite" };

const ROLE_BLURBS: Record<"viewer" | "editor" | "manager" | "owner", string> = {
  viewer: "You'll be able to view this site and its pages.",
  editor: "You'll be able to edit pages, content, and styling.",
  manager: "You'll be able to edit the site and manage who else has access.",
  owner: "You own this site.",
};

function InviteShell({ children }: { children: React.ReactNode }) {
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
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await getInvitePreview(token);

  if (!preview) {
    return (
      <InviteShell>
        <AlertCircle size={28} className="text-red-500 mx-auto" />
        <p className="text-sm font-medium">This invite link is invalid or has expired.</p>
        <Link href="/" className="inline-block text-sm font-medium text-[var(--primary)] hover:underline">
          Go to Sage Studio
        </Link>
      </InviteShell>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <InviteShell>
        <Globe size={28} className="text-[var(--primary)] mx-auto" />
        <div>
          <p className="text-sm font-medium">
            {preview.inviterName} invited you to collaborate on <strong>{preview.siteName}</strong> on Sage Studio.
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1.5">{ROLE_BLURBS[preview.role]}</p>
        </div>
        <Link
          href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity w-full"
        >
          Sign in or create a free account
        </Link>
        <p className="text-xs text-[var(--muted-foreground)] pt-3 border-t border-[var(--border)] leading-relaxed">
          Sage Studio is a free website builder for independent artists — build pages, manage a site, and
          collaborate with your team, free forever.{" "}
          <Link href="/" className="text-[var(--primary)] hover:underline">
            Learn more
          </Link>
        </p>
      </InviteShell>
    );
  }

  const result = await acceptInvite(token);

  return (
    <InviteShell>
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
          <div>
            <p className="text-sm font-medium">
              You now have <span className="capitalize">{result.role}</span> access to {result.siteName}.
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1.5">{ROLE_BLURBS[result.role]}</p>
          </div>
          <Link
            href={`/my-site/${result.siteId}`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Open {result.siteName}
          </Link>
        </>
      )}
    </InviteShell>
  );
}
