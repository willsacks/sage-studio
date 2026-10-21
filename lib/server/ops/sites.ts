import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";
import { Page } from "@/lib/server/contract/common";

const siteSummary = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  is_published: z.boolean(),
  role: z.enum(["owner", "manager", "editor", "viewer"]),
});

export const sitesList = defineOperation({
  id: "sites.list",
  tool: "sites_list",
  module: "sites",
  minScope: "read",
  http: { method: "GET", path: "/sites" },
  title: "List websites",
  description: "List the websites the user owns or collaborates on, with their role on each.",
  input: z.object({}),
  output: Page(siteSummary),
  handler: async (ctx) => {
    const { rows } = await ctx.db.query(
      `select s.id, s.name, s.slug, s.is_published,
              case when s.user_id = $1 then 'owner' else c.role end as role
       from public.artist_sites s
       left join public.site_collaborators c on c.site_id = s.id and c.user_id = $1 and c.status = 'accepted'
       where s.user_id = $1 or c.user_id = $1
       order by s.name asc`,
      [ctx.principal.userId]
    );
    return { items: rows, next_cursor: null };
  },
});

export const sitesGetPage = defineOperation({
  id: "sites.getPage",
  tool: "sites_get_page",
  module: "sites",
  minScope: "read",
  http: { method: "GET", path: "/sites/:siteId/pages/:pageId" },
  title: "Get a website page",
  description: "Get one page's content (title, status, and rendered HTML) from a website the user owns or collaborates on.",
  input: z.object({ siteId: z.string(), pageId: z.string() }),
  output: z.object({
    id: z.string(), title: z.string(), slug: z.string(), page_type: z.string(),
    status: z.enum(["draft", "published"]), html_content: z.string().nullable(), updated_at: z.string(),
  }),
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(
      `select id, title, slug, page_type, status, html_content, updated_at
       from public.site_pages where id = $1 and site_id = $2`,
      [input.pageId, input.siteId]
    );
    if (rows.length === 0) throw new Error("not_found");
    return rows[0];
  },
});

export const sitesOperations = [sitesList, sitesGetPage];
