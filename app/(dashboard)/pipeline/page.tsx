import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultStages } from "@/lib/actions/pipeline";
import { PipelineView } from "@/components/pipeline/PipelineView";

export const metadata: Metadata = { title: "Producer Pipeline" };

export type Stage = {
  id: string;
  name: string;
  color: string;
  position: number;
};

export type Contact = {
  id: string;
  name: string;
  stage_id: string | null;
  notes: string | null;
  collaborators: string | null;
  next_session: string | null;
  created_at: string;
};

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await ensureDefaultStages();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: stagesRaw }, { data: contactsRaw }] = await Promise.all([
    db
      .from("pipeline_stages")
      .select("id, name, color, position")
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    db
      .from("pipeline_contacts")
      .select("id, name, stage_id, notes, collaborators, next_session, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const stages = (stagesRaw ?? []) as Stage[];
  const contacts = (contactsRaw ?? []) as Contact[];

  return <PipelineView stages={stages} contacts={contacts} />;
}
