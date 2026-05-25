import { Settings } from "lucide-react";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
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
      <p className="text-sm text-[var(--muted-foreground)]">Settings coming soon.</p>
    </div>
  );
}
