import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NavVisibilityForm } from "@/components/settings/NavVisibilityForm";
import { AccountForm } from "@/components/settings/AccountForm";
import { AssistantConnections } from "@/components/settings/AssistantConnections";
import { listAssistantConnections } from "@/lib/actions/assistant-connections";
import { ConnectStripeButton } from "@/components/settings/ConnectStripeButton";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const connections = await listAssistantConnections();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("display_name, username, hidden_nav_items, stripe_connect_account_id, stripe_connect_charges_enabled")
    .eq("id", user!.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings size={22} /> Settings
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Manage your account preferences.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] px-5 py-4">
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Account</p>
        <AccountForm
          initialDisplayName={profile?.display_name ?? ""}
          initialUsername={profile?.username ?? ""}
          currentEmail={user!.email ?? ""}
        />
      </div>

      <div className="rounded-lg border border-[var(--border)] px-5 py-4">
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">Sidebar Menu</p>
        <p className="text-sm text-[var(--muted-foreground)] mb-3">
          Choose which sections show up in your menu.
        </p>
        <NavVisibilityForm initialHidden={(profile?.hidden_nav_items as string[] | null) ?? []} />
      </div>

      <div className="rounded-lg border border-[var(--border)] px-5 py-4">
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">Payments</p>
        <p className="text-sm text-[var(--muted-foreground)] mb-3">
          Connect Stripe to sell courses — payments go directly to your own account.
        </p>
        {profile?.stripe_connect_charges_enabled ? (
          <p className="text-sm text-green-600">Stripe is connected and ready to accept payments.</p>
        ) : profile?.stripe_connect_account_id ? (
          <ConnectStripeButton label="Finish Stripe setup" />
        ) : (
          <ConnectStripeButton />
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] px-5 py-4">
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Connected AI assistants</p>
        <AssistantConnections initialConnections={connections} />
      </div>
    </div>
  );
}
