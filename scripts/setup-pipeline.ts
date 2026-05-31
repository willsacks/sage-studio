/**
 * Creates pipeline_stages and pipeline_contacts tables for the Producer Pipeline feature.
 * Run: cd sage-studio && npx tsx scripts/setup-pipeline.ts
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
-- Pipeline stages (per user, fully customizable)
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pipeline_stages' AND policyname = 'Users manage own stages'
  ) THEN
    CREATE POLICY "Users manage own stages" ON pipeline_stages
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Pipeline contacts
CREATE TABLE IF NOT EXISTS pipeline_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  stage_id uuid REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  notes text,
  collaborators text,
  next_session date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pipeline_contacts' AND policyname = 'Users manage own contacts'
  ) THEN
    CREATE POLICY "Users manage own contacts" ON pipeline_contacts
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
`;

async function main() {
  console.log("Setting up pipeline tables...");

  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);

  if (error) {
    console.error("RPC exec_sql failed:", error.message);
    console.log("\nRun this SQL manually in the Supabase dashboard (SQL Editor):\n");
    console.log(SQL);
    process.exit(1);
  }

  console.log("✓ pipeline_stages table created");
  console.log("✓ pipeline_contacts table created");
  console.log("✓ RLS policies applied");
  console.log("\nDone. You can now use the Producer Pipeline feature.");
}

main().catch((err) => { console.error(err); process.exit(1); });
