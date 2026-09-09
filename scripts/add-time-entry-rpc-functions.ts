/**
 * Collapses starting/stopping a timer from up to 3 sequential DB round
 * trips down to 1 each, to fix reported latency when starting/stopping a
 * time entry. Previously `startTimer` (lib/actions/time-entries.ts) did a
 * SELECT (find any running entry) -> UPDATE (close it) -> INSERT (create
 * the new one), fully sequential; `stopTimer` did a SELECT (fetch
 * started_at) -> UPDATE (set stopped_at + duration). Each step was its own
 * network round trip to Supabase.
 *
 * These two SQL functions do the same work atomically, in the database,
 * using Postgres's own now() for both the timestamp and the duration
 * calculation (also sidesteps any clock skew between the app server and
 * the DB). `security invoker` (the default for `language sql`) means they
 * run under RLS as the calling user — auth.uid() inside the function
 * resolves the same way `user_id = auth.uid()` already does in
 * time_entries' existing RLS policy, so ownership is still enforced by the
 * database itself, not just app-level `.eq("user_id", ...)` filters.
 *
 * Run: cd sage-studio && npx tsx scripts/add-time-entry-rpc-functions.ts
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
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SQL = `
create or replace function public.start_time_entry(
  p_description text,
  p_category text,
  p_client_id uuid,
  p_todo_id uuid
)
returns table (id uuid, started_at timestamptz, description text, category text, client_id uuid)
language sql
security invoker
as $$
  with closed as (
    update public.time_entries
    set stopped_at = now(),
        duration_seconds = extract(epoch from (now() - started_at))::int
    where user_id = auth.uid() and stopped_at is null
    returning id
  )
  insert into public.time_entries (user_id, description, started_at, category, client_id, todo_id)
  values (auth.uid(), p_description, now(), p_category, p_client_id, p_todo_id)
  returning time_entries.id, time_entries.started_at, time_entries.description, time_entries.category, time_entries.client_id;
$$;

create or replace function public.stop_time_entry(p_entry_id uuid)
returns table (id uuid, duration_seconds int)
language sql
security invoker
as $$
  update public.time_entries
  set stopped_at = now(),
      duration_seconds = extract(epoch from (now() - started_at))::int
  where id = p_entry_id and user_id = auth.uid() and stopped_at is null
  returning time_entries.id, time_entries.duration_seconds;
$$;

grant execute on function public.start_time_entry(text, text, uuid, uuid) to authenticated;
grant execute on function public.stop_time_entry(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql failed: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ start_time_entry / stop_time_entry RPC functions added.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
