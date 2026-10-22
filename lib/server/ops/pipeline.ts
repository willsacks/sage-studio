import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";
import { Page } from "@/lib/server/contract/common";

const stageSummary = z.object({ id: z.string(), name: z.string(), color: z.string(), position: z.number() });

export const pipelineListStages = defineOperation({
  id: "pipeline.listStages",
  tool: "pipeline_list_stages",
  module: "pipeline",
  minScope: "read",
  http: { method: "GET", path: "/pipeline/stages" },
  title: "List pipeline stages",
  description: "Lists the user's pipeline stages in display order.",
  input: z.object({}),
  output: Page(stageSummary),
  handler: async (ctx) => {
    const { rows } = await ctx.db.query(
      `select id, name, color, position from public.pipeline_stages where user_id = $1 order by position asc`,
      [ctx.principal.userId]
    );
    return { items: rows, next_cursor: null };
  },
});

const contactSummary = z.object({
  id: z.string(),
  name: z.string(),
  stage_id: z.string().nullable(),
  next_action: z.string().nullable(),
  next_session: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  updated_at: z.string(),
});

export const pipelineListContacts = defineOperation({
  id: "pipeline.listContacts",
  tool: "pipeline_list_contacts",
  module: "pipeline",
  minScope: "read",
  http: { method: "GET", path: "/pipeline/contacts" },
  title: "List pipeline contacts",
  description: "Lists the user's pipeline contacts. Pass stageId to filter to one stage.",
  input: z.object({ stageId: z.string().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }),
  output: Page(contactSummary),
  handler: async (ctx, input) => {
    const params: unknown[] = [ctx.principal.userId];
    let where = "user_id = $1";
    if (input.stageId) {
      params.push(input.stageId);
      where += ` and stage_id = $${params.length}`;
    }
    params.push(input.limit);
    const { rows } = await ctx.db.query(
      `select id, name, stage_id, next_action, next_session, email, phone, updated_at
       from public.pipeline_contacts where ${where} order by updated_at desc limit $${params.length}`,
      params
    );
    return { items: rows, next_cursor: null };
  },
});

export const pipelineGetContact = defineOperation({
  id: "pipeline.getContact",
  tool: "pipeline_get_contact",
  module: "pipeline",
  minScope: "read",
  http: { method: "GET", path: "/pipeline/contacts/:id" },
  title: "Get a pipeline contact",
  description: "Gets one pipeline contact's full detail, including notes and tags.",
  input: z.object({ id: z.string() }),
  output: z.object({
    id: z.string(), name: z.string(), stage_id: z.string().nullable(), notes: z.string().nullable(),
    collaborators: z.string().nullable(), next_action: z.string().nullable(), next_session: z.string().nullable(),
    email: z.string().nullable(), phone: z.string().nullable(), updated_at: z.string(),
    tags: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() })),
  }),
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(
      `select id, name, stage_id, notes, collaborators, next_action, next_session, email, phone, updated_at
       from public.pipeline_contacts where id = $1 and user_id = $2`,
      [input.id, ctx.principal.userId]
    );
    if (rows.length === 0) throw new Error("not_found");
    const { rows: tags } = await ctx.db.query(
      `select t.id, t.name, t.color from public.pipeline_contact_tags ct
       join public.pipeline_tags t on t.id = ct.tag_id where ct.contact_id = $1`,
      [input.id]
    );
    return { ...rows[0], tags };
  },
});

export const pipelineOperations = [pipelineListStages, pipelineListContacts, pipelineGetContact];
