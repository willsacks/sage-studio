import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Leaf, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { acceptFinanceInvite } from "@/lib/actions/finance-collaborators";
import { getFinanceInvitePreview } from "@/lib/queries/finance-collaborators";

export const metadata: Metadata = { title: "Accept Invite" };

const ROLE_BLURBS: Record<"viewer" | "editor" | "manager" | "owner", string> = {
  viewer: "You'll be able to view these books.",
  editor: "You'll be able to categorize transactions, flag items for review, and manage invoices.",
  manager: "You'll be able to manage these books and who else has access.",
  owner: "You own these books.",
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

export default async function AcceptFinanceInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await getFinanceInvitePreview(token);

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
        <Wallet size={28} className="text-[var(--primary)] mx-auto" />
        <div>
          <p className="text-sm font-medium">
            {preview.inviterName} invited you to help manage <strong>{preview.entityName}</strong> on Sage Studio.
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1.5">{ROLE_BLURBS[preview.role]}</p>
        </div>
        <Link
          href={`/login?next=${encodeURIComponent(`/finance-invite/${token}`)}`}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity w-full"
        >
          Sign in or create a free account
        </Link>
      </InviteShell>
    );
  }

  const result = await acceptFinanceInvite(token);

  return (
    <InviteShell>
      {"error" in result ? (
        <>
          <AlertCircle size={28} className="text-red-500 mx-auto" />
          <p className="text-sm font-medium">{result.error}</p>
          <Link href="/finances" className="inline-block text-sm font-medium text-[var(--primary)] hover:underline">
            Go to Finances
          </Link>
        </>
      ) : (
        <>
          <CheckCircle2 size={28} className="text-emerald-500 mx-auto" />
          <div>
            <p className="text-sm font-medium">
              You now have <span className="capitalize">{result.role}</span> access to {result.entityName}.
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1.5">{ROLE_BLURBS[result.role]}</p>
          </div>
          <Link
            href="/finances"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Open Finances
          </Link>
        </>
      )}
    </InviteShell>
  );
}
