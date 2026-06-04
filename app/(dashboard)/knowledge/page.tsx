import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeView } from "@/components/knowledge/KnowledgeView";

export const metadata: Metadata = { title: "Knowledge" };

export type KnowledgeSection = {
  id: string;
  title: string;
  emoji: string | null;
  color: string;
  position: number;
};

export type KnowledgeEntry = {
  id: string;
  section_id: string | null;
  title: string;
  body: string;
  position: number;
  updated_at: string;
};

export default async function KnowledgePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: sectionsRaw }, { data: entriesRaw }] = await Promise.all([
    db
      .from("knowledge_sections")
      .select("id, title, emoji, color, position")
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    db
      .from("knowledge_entries")
      .select("id, section_id, title, body, position, updated_at")
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
  ]);

  return (
    <KnowledgeView
      sections={(sectionsRaw ?? []) as KnowledgeSection[]}
      entries={(entriesRaw ?? []) as KnowledgeEntry[]}
    />
  );
}
