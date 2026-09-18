import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NavVisibilityForm } from "@/components/settings/NavVisibilityForm";
import { AccountForm } from "@/components/settings/AccountForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("display_name, username, hidden_nav_items")
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
    </div>
  );
}
