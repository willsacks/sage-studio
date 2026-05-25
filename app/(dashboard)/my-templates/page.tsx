import { Store } from "lucide-react";

export const metadata = { title: "My Templates" };

export default function MyTemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store size={22} /> My Templates
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Save and reuse your page designs.
        </p>
      </div>
      <div className="text-center py-16 text-[var(--muted-foreground)]">
        <Store size={36} className="mx-auto mb-3 opacity-20" />
        <p className="text-sm">No templates yet. Save a page design to create one.</p>
      </div>
    </div>
  );
}
