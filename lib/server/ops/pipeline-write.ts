import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";

export const pipelineCreateStage = defineOperation({
  id: "pipeline.createStage",
  tool: "pipeline_create_stage",
  module: "pipeline",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/pipeline/stages" },
  title: "Create a pipeline stage",
  description: "Creates a new pipeline stage at the end of the list.",
  input: z.object({ name: z.string().min(1).max(100), color: z.string().min(1).max(20) }),
  output: z.object({ id: z.string(), name: z.string(), color: z.string(), position: z.number() }),
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(
      `insert into public.pipeline_stages (user_id, name, color, position)
       values ($1, $2, $3, (select coalesce(max(position), -1) + 1 from public.pipeline_stages where user_id = $1))
       returning id, name, color, position`,
      [ctx.principal.userId, input.name.trim(), input.color]
    );
    return rows[0];
  },
});

export const pipelineCreateContact = defineOperation({
  id: "pipeline.createContact",
  tool: "pipeline_create_contact",
  module: "pipeline",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/pipeline/contacts" },
  title: "Create a pipeline contact",
  description: "Adds a new contact to the pipeline, optionally placed directly into a stage.",
  input: z.object({ name: z.string().min(1).max(200), stageId: z.string().nullable().optional(), nextAction: z.string().nullable().optional() }),
  output: z.object({ id: z.string() }),
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(
      `insert into public.pipeline_contacts (user_id, name, stage_id, next_action) values ($1, $2, $3, $4) returning id`,
      [ctx.principal.userId, input.name.trim(), input.stageId ?? null, input.nextAction ?? null]
    );
    return { id: rows[0].id };
  },
});

export const pipelineUpdateContact = defineOperation({
  id: "pipeline.updateContact",
  tool: "pipeline_update_contact",
  module: "pipeline",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/pipeline/contacts/:id" },
  title: "Update a pipeline contact",
  description: "Edits a pipeline contact's stage, notes, or contact info. Only pass the fields you want to change.",
  input: z.object({
    id: z.string(),
    name: z.string().min(1).max(200).optional(),
    stageId: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    nextAction: z.string().nullable().optional(),
    nextSession: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
  output: z.object({ id: z.string() }),
  handler: async (ctx, input) => {
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [input.id, ctx.principal.userId];
    const addField = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`); };
    if (input.name !== undefined) addField("name", input.name.trim());
    if (input.stageId !== undefined) addField("stage_id", input.stageId);
    if (input.notes !== undefined) addField("notes", input.notes);
    if (input.nextAction !== undefined) addField("next_action", input.nextAction);
    if (input.nextSession !== undefined) addField("next_session", input.nextSession);
    if (input.email !== undefined) addField("email", input.email);
    if (input.phone !== undefined) addField("phone", input.phone);

    const { rows } = await ctx.db.query(
      `update public.pipeline_contacts set ${sets.join(", ")} where id = $1 and user_id = $2 returning id`,
      params
    );
    if (rows.length === 0) throw new Error("not_found");
    return { id: rows[0].id };
  },
});

export const pipelineWriteOperations = [pipelineCreateStage, pipelineCreateContact, pipelineUpdateContact];
