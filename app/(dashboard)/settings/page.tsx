import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
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

      <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Account</p>
          <dl className="space-y-3">
            {profile?.display_name && (
              <div className="flex items-center justify-between">
                <dt className="text-sm text-[var(--muted-foreground)]">Name</dt>
                <dd className="text-sm font-medium">{profile.display_name}</dd>
              </div>
            )}
            {profile?.username && (
              <div className="flex items-center justify-between">
                <dt className="text-sm text-[var(--muted-foreground)]">Username</dt>
                <dd className="text-sm font-medium">@{profile.username}</dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-sm text-[var(--muted-foreground)]">Email</dt>
              <dd className="text-sm font-medium">{user!.email}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
