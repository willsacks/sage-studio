/**
 * Adds a lightweight blog/post system for artist sites — separate from
 * site_pages since posts are chronological/listable (a "News" or "Blog"
 * archive) rather than structural pages with their own nav slot. Mirrors
 * site_pages' shape closely (title/slug/status/meta fields, html_content
 * for the body — same "paste/import HTML" trust model already used and
 * security-reviewed for pages) so the upcoming WordPress importer can
 * treat "insert a page" and "insert a post" as near-identical operations.
 *
 * Run: cd sage-studio && npx tsx scripts/add-site-posts-schema.ts
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

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "create site_posts table",
    sql: `
      create table if not exists public.site_posts (
        id uuid primary key default gen_random_uuid(),
        site_id uuid not null references public.artist_sites(id) on delete cascade,
        user_id uuid not null,
        title text not null,
        slug text not null,
        excerpt text,
        cover_image_url text,
        html_content text,
        status text not null default 'draft' check (status in ('draft','published')),
        meta_title text,
        meta_description text,
        published_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (site_id, slug)
      );
    `,
  },
  {
    label: "index site_posts by site",
    sql: `create index if not exists site_posts_site_id_idx on public.site_posts (site_id, published_at desc);`,
  },
  {
    label: "enable RLS on site_posts",
    sql: `alter table public.site_posts enable row level security;`,
  },
  {
    label: "policy: members access their site's posts",
    sql: `
      drop policy if exists "Members access their site posts" on public.site_posts;
      create policy "Members access their site posts" on public.site_posts
        for all
        using (
          exists (select 1 from public.artist_sites a where a.id = site_id and a.user_id = auth.uid())
          or exists (
            select 1 from public.site_collaborators c
            where c.site_id = site_posts.site_id and c.user_id = auth.uid() and c.status = 'accepted'
          )
        )
        with check (
          exists (select 1 from public.artist_sites a where a.id = site_id and a.user_id = auth.uid())
          or exists (
            select 1 from public.site_collaborators c
            where c.site_id = site_posts.site_id and c.user_id = auth.uid() and c.status = 'accepted'
              and c.role in ('editor','manager','owner')
          )
        );
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
