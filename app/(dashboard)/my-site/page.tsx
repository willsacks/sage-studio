import { redirect } from "next/navigation";
import Link from "next/link";
import { Globe, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My Websites" };

export default async function MySitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sites } = await supabase
    .from("artist_sites")
    .select("id, name, slug, is_published, custom_domain, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe size={22} /> My Websites
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1 text-sm">
            Build and publish your artist site.
          </p>
        </div>
        <Link
          href="/my-site/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={15} /> New site
        </Link>
      </div>

      {sites && sites.length > 0 ? (
        <div className="grid gap-3">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/my-site/${site.id}`}
              className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center">
                  <Globe size={16} className="text-[var(--primary)]" />
                </div>
                <div>
                  <p className="text-sm font-medium">{site.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {site.custom_domain ?? `sagestudio.org/sites/${site.slug}`}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                site.is_published
                  ? "bg-green-100 text-green-700"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}>
                {site.is_published ? "Live" : "Draft"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-[var(--muted-foreground)]">
          <Globe size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm mb-4">You don't have a site yet.</p>
          <Link
            href="/my-site/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> Create your first site
          </Link>
        </div>
      )}
    </div>
  );
}
