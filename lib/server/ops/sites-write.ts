import { z } from "zod";
import type { PoolClient } from "pg";
import { defineOperation } from "@/lib/server/contract/operation";
import { revalidateSiteCacheFromRoute } from "@/lib/queries/sites";

const ROLE_RANK: Record<string, number> = { viewer: 0, editor: 1, manager: 2, owner: 3 };

/** Mirrors lib/access/site-access.ts's requireSiteRole — editing a page's
 * HTML needs editor+ even though read access only needs any collaborator
 * role, same floor the web app's own save route enforces (see
 * app/api/site-pages/update-html/route.ts). RLS on site_pages doesn't
 * encode this role threshold itself, only "is a collaborator at all", so
 * this check is load-bearing, not defense-in-depth. */
async function requireEditorRole(db: PoolClient, siteId: string, userId: string): Promise<void> {
  const { rows } = await db.query(
    `select case when s.user_id = $2 then 'owner' else c.role end as role
     from public.artist_sites s
     left join public.site_collaborators c on c.site_id = s.id and c.user_id = $2 and c.status = 'accepted'
     where s.id = $1 and (s.user_id = $2 or c.user_id = $2)`,
    [siteId, userId]
  );
  const role = rows[0]?.role as string | undefined;
  if (!role || (ROLE_RANK[role] ?? -1) < ROLE_RANK.editor) throw new Error("not_found");
}

export const sitesUpdatePage = defineOperation({
  id: "sites.updatePage",
  tool: "sites_update_page",
  module: "sites",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/sites/:siteId/pages/:pageId" },
  title: "Update a website page",
  description: "Replaces a page's HTML content. Call sites_get_page first to read its current updated_at — pass that back as expectedUpdatedAt so this fails instead of overwriting a change made elsewhere in the meantime.",
  input: z.object({ siteId: z.string(), pageId: z.string(), htmlContent: z.string().max(1_000_000), expectedUpdatedAt: z.string() }),
  output: z.object({ id: z.string(), updated_at: z.string() }),
  handler: async (ctx, input) => {
    await requireEditorRole(ctx.db, input.siteId, ctx.principal.userId);

    const { rows } = await ctx.db.query(
      `update public.site_pages set html_content = $1, updated_at = now()
       where id = $2 and site_id = $3 and updated_at = $4
       returning id, updated_at`,
      [input.htmlContent, input.pageId, input.siteId, input.expectedUpdatedAt]
    );
    if (rows.length === 0) {
      const { rows: exists } = await ctx.db.query(`select 1 from public.site_pages where id = $1 and site_id = $2`, [input.pageId, input.siteId]);
      if (exists.length === 0) throw new Error("not_found");
      throw new Error("conflict");
    }
    await revalidateSiteCacheFromRoute(input.siteId);
    return rows[0];
  },
});

export const sitesWriteOperations = [sitesUpdatePage];
