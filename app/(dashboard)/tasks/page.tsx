import { Timer } from "lucide-react";

export const metadata = { title: "Time Tracker" };

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Timer size={22} /> Time Tracker
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Track time on your creative work.
        </p>
      </div>
      <div className="text-center py-16 text-[var(--muted-foreground)]">
        <Timer size={36} className="mx-auto mb-3 opacity-20" />
        <p className="text-sm">Time tracking coming soon.</p>
      </div>
    </div>
  );
}
