/**
 * Creates the knowledge_sections and knowledge_entries tables backing the
 * Knowledge section (handbook-style notes), which was shipped in code but
 * never had its schema applied.
 * Run: cd sage-studio && npx tsx scripts/add-knowledge-tables.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SQL = `
CREATE TABLE IF NOT EXISTS public.knowledge_sections (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  emoji       text,
  color       text        NOT NULL,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sections_user ON public.knowledge_sections(user_id);

ALTER TABLE public.knowledge_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own knowledge sections" ON public.knowledge_sections;
CREATE POLICY "Users manage own knowledge sections" ON public.knowledge_sections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.knowledge_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_id  uuid        REFERENCES public.knowledge_sections(id) ON DELETE SET NULL,
  title       text        NOT NULL DEFAULT 'Untitled',
  body        text        NOT NULL DEFAULT '',
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user ON public.knowledge_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_section ON public.knowledge_entries(section_id);

ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own knowledge entries" ON public.knowledge_entries;
CREATE POLICY "Users manage own knowledge entries" ON public.knowledge_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);

  if (error) {
    const { error: e2 } = await supabase.from("knowledge_sections").select("id").limit(1);
    if (e2?.message?.includes("does not exist") || e2?.code === "PGRST205") {
      console.error("Tables do not exist and could not be created via RPC.");
      console.log("Run this SQL manually in the Supabase dashboard SQL editor:\n");
      console.log(SQL);
      process.exit(1);
    } else {
      console.log("✓ knowledge tables already exist (or were created successfully).");
    }
  } else {
    console.log("✓ knowledge_sections and knowledge_entries tables created.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
