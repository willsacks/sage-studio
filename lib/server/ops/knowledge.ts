import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";
import { Page, Limit } from "@/lib/server/contract/common";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const entrySummary = z.object({
  id: z.string(),
  title: z.string(),
  section_id: z.string().nullable(),
  section_title: z.string().nullable(),
  preview: z.string(),
  updated_at: z.string(),
});

export const knowledgeSearch = defineOperation({
  id: "knowledge.search",
  tool: "knowledge_search",
  module: "knowledge",
  minScope: "read",
  http: { method: "GET", path: "/knowledge" },
  title: "Search knowledge base entries",
  description: "Search the user's knowledge base by title/body text. Omit text to list everything, newest first.",
  input: z.object({ text: z.string().max(200).optional(), limit: Limit }),
  output: Page(entrySummary),
  handler: async (ctx, input) => {
    const params: unknown[] = [ctx.principal.userId];
    let where = "e.user_id = $1";
    if (input.text) {
      params.push(`%${input.text}%`);
      where += ` and (e.title ilike $${params.length} or e.body ilike $${params.length})`;
    }
    params.push(input.limit);
    const { rows } = await ctx.db.query(
      `select e.id, e.title, e.section_id, s.title as section_title, e.body, e.updated_at
       from public.knowledge_entries e left join public.knowledge_sections s on s.id = e.section_id
       where ${where} order by e.updated_at desc limit $${params.length}`,
      params
    );
    return {
      items: rows.map((r) => ({
        id: r.id, title: r.title, section_id: r.section_id, section_title: r.section_title,
        preview: stripHtml(r.body ?? "").slice(0, 200), updated_at: r.updated_at,
      })),
      next_cursor: null,
    };
  },
});

export const knowledgeGetEntry = defineOperation({
  id: "knowledge.getEntry",
  tool: "knowledge_get_entry",
  module: "knowledge",
  minScope: "read",
  http: { method: "GET", path: "/knowledge/:id" },
  title: "Get a knowledge base entry",
  description: "Get one knowledge base entry's full body (as plain text — HTML formatting stripped) by id.",
  input: z.object({ id: z.string() }),
  output: z.object({
    id: z.string(), title: z.string(), section_id: z.string().nullable(), section_title: z.string().nullable(),
    body: z.string(), updated_at: z.string(),
  }),
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(
      `select e.id, e.title, e.section_id, s.title as section_title, e.body, e.updated_at
       from public.knowledge_entries e left join public.knowledge_sections s on s.id = e.section_id
       where e.id = $1 and e.user_id = $2`,
      [input.id, ctx.principal.userId]
    );
    if (rows.length === 0) throw new Error("not_found");
    const r = rows[0];
    return { id: r.id, title: r.title, section_id: r.section_id, section_title: r.section_title, body: stripHtml(r.body ?? ""), updated_at: r.updated_at };
  },
});

export const knowledgeOperations = [knowledgeSearch, knowledgeGetEntry];
