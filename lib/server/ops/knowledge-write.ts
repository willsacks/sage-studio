import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";

// Mirrors components/knowledge/EntryEditor.tsx's toEditorHtml — plain-text
// input (e.g. dictated content) becomes one <p> per line so it round-trips
// through the rich-text editor the same way a legacy plain-text entry does;
// anything that already looks like HTML is passed through untouched.
function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function toEditorHtml(value: string): string {
  if (!value) return "";
  if (looksLikeHtml(value)) return value;
  return value.split("\n").map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`).join("");
}

const entryDetail = z.object({
  id: z.string(),
  title: z.string(),
  section_id: z.string().nullable(),
  updated_at: z.string(),
});

export const knowledgeCreateEntry = defineOperation({
  id: "knowledge.createEntry",
  tool: "knowledge_create_entry",
  module: "knowledge",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/knowledge" },
  title: "Create a knowledge base entry",
  description: "Creates a new knowledge base article. Body can be plain text (e.g. dictated) or HTML — plain text is converted to formatted paragraphs automatically.",
  input: z.object({ title: z.string().min(1).max(300), body: z.string().max(200_000), sectionId: z.string().nullable().optional() }),
  output: entryDetail,
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(
      `insert into public.knowledge_entries (user_id, section_id, title, body, position)
       values ($1, $2, $3, $4, (select coalesce(max(position), -1) + 1 from public.knowledge_entries where user_id = $1))
       returning id, title, section_id, updated_at`,
      [ctx.principal.userId, input.sectionId ?? null, input.title.trim() || "Untitled", toEditorHtml(input.body)]
    );
    return rows[0];
  },
});

export const knowledgeUpdateEntry = defineOperation({
  id: "knowledge.updateEntry",
  tool: "knowledge_update_entry",
  module: "knowledge",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/knowledge/:id" },
  title: "Update a knowledge base entry",
  description: "Edits a knowledge base article's title, body, and/or section. Only pass the fields you want to change.",
  input: z.object({
    id: z.string(),
    title: z.string().min(1).max(300).optional(),
    body: z.string().max(200_000).optional(),
    sectionId: z.string().nullable().optional(),
  }),
  output: entryDetail,
  handler: async (ctx, input) => {
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [input.id, ctx.principal.userId];
    if (input.title !== undefined) { params.push(input.title.trim() || "Untitled"); sets.push(`title = $${params.length}`); }
    if (input.body !== undefined) { params.push(toEditorHtml(input.body)); sets.push(`body = $${params.length}`); }
    if (input.sectionId !== undefined) { params.push(input.sectionId); sets.push(`section_id = $${params.length}`); }

    const { rows } = await ctx.db.query(
      `update public.knowledge_entries set ${sets.join(", ")} where id = $1 and user_id = $2
       returning id, title, section_id, updated_at`,
      params
    );
    if (rows.length === 0) throw new Error("not_found");
    return rows[0];
  },
});

export const knowledgeWriteOperations = [knowledgeCreateEntry, knowledgeUpdateEntry];
