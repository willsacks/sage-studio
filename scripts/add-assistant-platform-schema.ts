/**
 * M1 — DB foundation for the Sage Studio public API / MCP server.
 *
 * New schema `sage` (never exposed to PostgREST — see the revoke below),
 * a dedicated `sage_api` Postgres role for the API/MCP code path to
 * `SET LOCAL ROLE authenticated` under (see lib/server/db/with-rls.ts),
 * and the OAuth/connection/audit tables. No `workspace_id` anywhere —
 * see docs/schema-map.md: Sage Studio has no workspace concept, every
 * grant belongs to one user_id, and per-resource permission (SiteRole,
 * Finance entity role) is checked in application code per module, not
 * in a workspace-role trigger like the original spec this was adapted
 * from assumed.
 *
 * Run: cd sage-studio && npx tsx scripts/add-assistant-platform-schema.ts
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

const SAGE_API_PASSWORD = process.env.SAGE_API_DB_PASSWORD;
if (!SAGE_API_PASSWORD) {
  console.error("✗ Set SAGE_API_DB_PASSWORD in .env.local before running this (the password for the new sage_api Postgres role).");
  process.exit(1);
}

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "create sage schema, revoke from PostgREST-exposed roles",
    sql: `
      create schema if not exists sage;
      revoke all on schema sage from public, anon;
      grant usage on schema sage to authenticated;
    `,
  },
  {
    label: "create sage_api role",
    sql: `
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'sage_api') then
          create role sage_api login noinherit nobypassrls password '${SAGE_API_PASSWORD.replace(/'/g, "''")}';
        else
          execute format('alter role sage_api password %L', '${SAGE_API_PASSWORD.replace(/'/g, "''")}');
        end if;
      end $$;
      grant authenticated to sage_api;
      grant usage on schema sage to sage_api;
    `,
  },
  {
    label: "oauth_clients",
    sql: `
      create table if not exists sage.oauth_clients (
        id text primary key,
        kind text not null check (kind in ('cimd','dcr','pat','static')),
        client_name text not null,
        client_uri text,
        display_host text,
        redirect_uris text[] not null default '{}',
        token_endpoint_auth_method text not null default 'none'
          check (token_endpoint_auth_method in ('none','client_secret_basic','client_secret_post')),
        client_secret_hash text,
        metadata jsonb not null default '{}',
        metadata_expires_at timestamptz,
        verified boolean not null default false,
        status text not null default 'active' check (status in ('active','disabled')),
        disabled_reason text,
        created_ip_hash text,
        created_at timestamptz not null default now()
      );
    `,
  },
  {
    label: "oauth_authorization_requests",
    sql: `
      create table if not exists sage.oauth_authorization_requests (
        id uuid primary key default gen_random_uuid(),
        client_id text not null references sage.oauth_clients(id) on delete cascade,
        redirect_uri text not null,
        state text,
        code_challenge text not null,
        resource text not null,
        scopes_requested text[] not null,
        user_id uuid references auth.users(id) on delete cascade,
        consumed_at timestamptz,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null default now() + interval '10 minutes'
      );
    `,
  },
  {
    label: "connected_apps (the grant — no workspace_id)",
    sql: `
      create table if not exists sage.connected_apps (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        client_id text not null references sage.oauth_clients(id),
        kind text not null default 'oauth' check (kind in ('oauth','pat')),
        display_name text not null,
        scopes jsonb not null default '{}',
        status text not null default 'active' check (status in ('active','paused','revoked')),
        expires_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        last_used_at timestamptz,
        revoked_at timestamptz,
        revoked_by uuid,
        revoke_reason text
      );
      create index if not exists connected_apps_user_id_idx on sage.connected_apps (user_id) where status <> 'revoked';
    `,
  },
  {
    label: "oauth_authorization_codes",
    sql: `
      create table if not exists sage.oauth_authorization_codes (
        code_hash text primary key,
        request_id uuid not null references sage.oauth_authorization_requests(id) on delete cascade,
        grant_id uuid not null references sage.connected_apps(id) on delete cascade,
        client_id text not null,
        redirect_uri text not null,
        code_challenge text not null,
        resource text not null,
        user_id uuid not null,
        scopes jsonb not null,
        expires_at timestamptz not null,
        consumed_at timestamptz
      );
    `,
  },
  {
    label: "oauth_refresh_tokens",
    sql: `
      create table if not exists sage.oauth_refresh_tokens (
        token_hash text primary key,
        grant_id uuid not null references sage.connected_apps(id) on delete cascade,
        client_id text not null,
        family_id uuid not null,
        resource text not null,
        scopes jsonb not null,
        created_at timestamptz not null default now(),
        last_used_at timestamptz,
        expires_at timestamptz not null,
        rotated_at timestamptz,
        revoked_at timestamptz
      );
      create index if not exists oauth_refresh_tokens_family_id_idx on sage.oauth_refresh_tokens (family_id);
      create index if not exists oauth_refresh_tokens_grant_id_idx on sage.oauth_refresh_tokens (grant_id);
    `,
  },
  {
    label: "oauth_revoked_jti",
    sql: `
      create table if not exists sage.oauth_revoked_jti (
        jti text primary key,
        expires_at timestamptz not null
      );
    `,
  },
  {
    label: "personal_access_tokens",
    sql: `
      create table if not exists sage.personal_access_tokens (
        token_hash text primary key,
        grant_id uuid not null unique references sage.connected_apps(id) on delete cascade,
        prefix text not null,
        created_at timestamptz not null default now()
      );
    `,
  },
  {
    label: "api_audit_log (append-only)",
    sql: `
      create table if not exists sage.api_audit_log (
        id bigint generated always as identity primary key,
        ts timestamptz not null default now(),
        request_id text not null,
        user_id uuid,
        client_id text,
        grant_id uuid,
        channel text not null check (channel in ('mcp','api','web','pat','oauth')),
        operation text not null,
        tool text,
        module text,
        resource_id text,
        target_refs jsonb not null default '[]',
        args_redacted jsonb not null default '{}',
        result_status text not null check (result_status in ('ok','error','denied','rate_limited')),
        error_code text,
        http_status int,
        rows_returned int,
        latency_ms int,
        ip_hash text,
        user_agent text
      );
      create index if not exists api_audit_log_user_id_idx on sage.api_audit_log (user_id, ts desc);
      create index if not exists api_audit_log_grant_id_idx on sage.api_audit_log (grant_id, ts desc);

      create or replace function sage.audit_immutable() returns trigger language plpgsql as $$
      begin raise exception 'api_audit_log is append-only'; end $$;

      drop trigger if exists api_audit_log_no_update on sage.api_audit_log;
      create trigger api_audit_log_no_update before update or delete on sage.api_audit_log
        for each row execute function sage.audit_immutable();
    `,
  },
  {
    label: "grant validation trigger (scopes only — no workspace role)",
    sql: `
      create or replace function sage.validate_grant() returns trigger
      language plpgsql security definer set search_path = '' as $$
      declare
        v_valid_modules text[] := array['todos','knowledge','time_tracking','sites','finance','courses'];
        v_valid_levels text[] := array['none','read','write'];
        k text;
        v text;
      begin
        for k, v in select * from jsonb_each_text(new.scopes) loop
          if not (k = any(v_valid_modules)) then raise exception 'unknown scope module: %', k; end if;
          if not (v = any(v_valid_levels)) then raise exception 'invalid scope level for %: %', k, v; end if;
        end loop;
        new.updated_at := now();
        return new;
      end $$;

      drop trigger if exists connected_apps_validate on sage.connected_apps;
      create trigger connected_apps_validate before insert or update of scopes
        on sage.connected_apps for each row execute function sage.validate_grant();
    `,
  },
  {
    label: "revoke cascades to refresh tokens",
    sql: `
      create or replace function sage.revoke_grant_tokens() returns trigger
      language plpgsql security definer set search_path = '' as $$
      begin
        if new.status <> 'active' and old.status = 'active' then
          update sage.oauth_refresh_tokens set revoked_at = now() where grant_id = new.id and revoked_at is null;
        end if;
        return new;
      end $$;

      drop trigger if exists connected_apps_revoke on sage.connected_apps;
      create trigger connected_apps_revoke after update of status on sage.connected_apps
        for each row execute function sage.revoke_grant_tokens();
    `,
  },
  {
    label: "current_grant() — the per-request check, runs as the user",
    sql: `
      create or replace function sage.current_grant(p_gid uuid)
      returns table (grant_id uuid, user_id uuid, client_id text, display_name text, scopes jsonb)
      language sql stable as $$
        select g.id, g.user_id, g.client_id, g.display_name, g.scopes
        from sage.connected_apps g
        where g.id = p_gid and g.user_id = auth.uid() and g.status = 'active'
          and (g.expires_at is null or g.expires_at > now())
      $$;
    `,
  },
  {
    label: "claim helpers",
    sql: `
      create or replace function sage.claims() returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
      $$;
      create or replace function sage.channel() returns text language sql stable as $$
        select sage.claims() #>> '{sage,channel}'
      $$;
      create or replace function sage.via_api() returns boolean language sql stable as $$
        select sage.channel() is not null
      $$;
      -- Defense-in-depth for the collaborator modules (sites, finance) — see
      -- docs/schema-map.md: the single-owner modules (todos/knowledge/
      -- time_tracking) don't need this, their existing auth.uid()=user_id
      -- policies already scope correctly regardless of channel.
      create or replace function sage.api_scope_allows(p_module text, p_level text default 'read')
      returns boolean language sql stable as $$
        select case
          when sage.channel() is null or sage.channel() = 'web' then true
          else coalesce(
            (sage.claims() #>> array['sage','scopes', p_module]) = 'write'
            or ((sage.claims() #>> array['sage','scopes', p_module]) = 'read' and p_level = 'read'),
            false
          )
        end
      $$;
    `,
  },
  {
    label: "enable RLS + grants on sage.* tables",
    sql: `
      alter table sage.oauth_clients                enable row level security;
      alter table sage.oauth_authorization_requests  enable row level security;
      alter table sage.oauth_authorization_codes     enable row level security;
      alter table sage.oauth_refresh_tokens          enable row level security;
      alter table sage.oauth_revoked_jti             enable row level security;
      alter table sage.personal_access_tokens        enable row level security;
      alter table sage.connected_apps                enable row level security;
      alter table sage.api_audit_log                 enable row level security;

      grant select, insert, update, delete on
        sage.oauth_clients, sage.oauth_authorization_requests, sage.oauth_authorization_codes,
        sage.oauth_refresh_tokens, sage.oauth_revoked_jti, sage.personal_access_tokens
        to sage_api;
      drop policy if exists p_api on sage.oauth_clients;
      create policy p_api on sage.oauth_clients for all to sage_api using (true) with check (true);
      drop policy if exists p_api on sage.oauth_authorization_requests;
      create policy p_api on sage.oauth_authorization_requests for all to sage_api using (true) with check (true);
      drop policy if exists p_api on sage.oauth_authorization_codes;
      create policy p_api on sage.oauth_authorization_codes for all to sage_api using (true) with check (true);
      drop policy if exists p_api on sage.oauth_refresh_tokens;
      create policy p_api on sage.oauth_refresh_tokens for all to sage_api using (true) with check (true);
      drop policy if exists p_api on sage.oauth_revoked_jti;
      create policy p_api on sage.oauth_revoked_jti for all to sage_api using (true) with check (true);
      drop policy if exists p_api on sage.personal_access_tokens;
      create policy p_api on sage.personal_access_tokens for all to sage_api using (true) with check (true);

      grant select (id, kind, client_name, client_uri, display_host, redirect_uris, verified, status, created_at)
        on sage.oauth_clients to authenticated;
      drop policy if exists p_read_clients on sage.oauth_clients;
      create policy p_read_clients on sage.oauth_clients for select to authenticated using (status = 'active');

      grant insert on sage.personal_access_tokens to authenticated;
      drop policy if exists p_pat_insert on sage.personal_access_tokens;
      create policy p_pat_insert on sage.personal_access_tokens for insert to authenticated
        with check (exists (select 1 from sage.connected_apps g where g.id = grant_id and g.user_id = auth.uid() and g.kind = 'pat'));

      grant select, insert on sage.connected_apps to authenticated;
      grant update (status, revoked_at, revoked_by, revoke_reason, scopes) on sage.connected_apps to authenticated;
      drop policy if exists p_select on sage.connected_apps;
      create policy p_select on sage.connected_apps for select to authenticated using (user_id = auth.uid());
      drop policy if exists p_insert on sage.connected_apps;
      create policy p_insert on sage.connected_apps for insert to authenticated with check (user_id = auth.uid());
      drop policy if exists p_update on sage.connected_apps;
      create policy p_update on sage.connected_apps for update to authenticated
        using (user_id = auth.uid()) with check (user_id = auth.uid());
      grant select on sage.connected_apps to sage_api;
      drop policy if exists p_api_read on sage.connected_apps;
      create policy p_api_read on sage.connected_apps for select to sage_api using (true);

      grant insert on sage.api_audit_log to sage_api;
      drop policy if exists p_api_insert on sage.api_audit_log;
      create policy p_api_insert on sage.api_audit_log for insert to sage_api with check (true);
      grant select on sage.api_audit_log to authenticated;
      drop policy if exists p_select on sage.api_audit_log;
      create policy p_select on sage.api_audit_log for select to authenticated using (user_id = auth.uid());
      -- Platform Admin cross-user visibility (not in the original spec):
      -- admin/manager profiles.role can read every row, same model as
      -- lib/access/platform-access.ts's canManagePlatform.
      drop policy if exists p_admin_select on sage.api_audit_log;
      create policy p_admin_select on sage.api_audit_log for select to authenticated
        using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
    `,
  },
];

async function main() {
  let failed = false;
  for (const { label, sql } of STATEMENTS) {
    const { error } = await supabase.rpc("exec_sql" as never, { sql } as never);
    if (error) {
      console.error(`✗ ${label}: ${error.message}`);
      console.log(sql);
      failed = true;
    } else {
      console.log(`✓ ${label}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
