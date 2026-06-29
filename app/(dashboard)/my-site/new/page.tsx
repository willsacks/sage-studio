import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NewSiteWizard } from "@/components/site/NewSiteWizard";

export const metadata: Metadata = { title: "Create New Website" };

export default async function NewSitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <Link
        href="/my-site"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={14} /> Sites
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Create New Website</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Each site gets its own URL, pages, and design aesthetic.</p>
      </div>
      <NewSiteWizard />
    </div>
  );
}
