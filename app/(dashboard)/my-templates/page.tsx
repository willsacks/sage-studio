import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyTemplates } from "@/lib/queries/offer-templates";
import { deletePersonalTemplate } from "@/lib/actions/offer-templates";
import { FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";

export const metadata: Metadata = { title: "My Templates" };

export default async function MyTemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const templates = await getMyTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Templates</h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Page designs you&apos;ve saved from the site builder.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 border-2 border-dashed border-[var(--border)] rounded-xl text-center">
          <FileText size={40} className="text-[var(--muted-foreground)] opacity-30" />
          <p className="text-[var(--muted-foreground)]">
            <span className="block font-medium text-[var(--foreground)]">No saved templates</span>
            <span className="text-sm">
              Open a page in the site builder and click &quot;Save as Template&quot; to save it here.
            </span>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden"
            >
              <div className="aspect-video bg-[var(--muted)] flex items-center justify-center">
                <FileText size={32} className="text-[var(--muted-foreground)] opacity-40" />
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="font-semibold leading-tight">{t.title}</p>
                  {t.description && (
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
                      {t.description}
                    </p>
                  )}
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Saved {format(new Date(t.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex justify-end">
                  <form action={async () => { "use server"; await deletePersonalTemplate(t.id); }}>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
