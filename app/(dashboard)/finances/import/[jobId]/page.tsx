import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImportProgress } from "@/components/finances/ImportProgress";

export const metadata: Metadata = { title: "Importing — Finances" };

export default async function ImportJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-lg mx-auto space-y-4 py-8">
      <div>
        <h1 className="text-xl font-bold">Importing your books</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">We'll bring you here again if you leave and come back.</p>
      </div>
      <ImportProgress jobId={jobId} />
    </div>
  );
}
