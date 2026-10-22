import { z } from "zod";
import { defineOperation, OpValidationError } from "@/lib/server/contract/operation";
import { getResendClientForUser } from "@/lib/email/resend-client";

/** See lib/server/ops/newsletter.ts's doc comment — same "no Resend API
 * key management, no sending a real broadcast" exclusions apply here.
 * These three are genuinely reversible, no-external-world-side-effect
 * writes (creating a list, adding/removing a contact from it), which is
 * exactly the line every other write tool in this project draws. */
async function requireResend(userId: string) {
  const resend = await getResendClientForUser(userId);
  if (!resend) throw new OpValidationError("Connect Resend first, in Settings → Newsletter.");
  return resend;
}

export const newsletterCreateList = defineOperation({
  id: "newsletter.createList",
  tool: "newsletter_create_list",
  module: "newsletter",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/newsletter/lists" },
  title: "Create a newsletter list",
  description: "Creates a new Resend audience (newsletter list).",
  input: z.object({ name: z.string().min(1).max(200) }),
  output: z.object({ id: z.string(), name: z.string() }),
  handler: async (ctx, input) => {
    const resend = await requireResend(ctx.principal.userId);
    const { data, error } = await resend.audiences.create({ name: input.name.trim() });
    if (error) throw new OpValidationError(`${error.message} (this is a limit on the connected Resend account's own plan, not Sage Studio)`);
    if (!data) throw new Error("not_found");
    return { id: data.id, name: data.name };
  },
});

export const newsletterAddContact = defineOperation({
  id: "newsletter.addContact",
  tool: "newsletter_add_contact",
  module: "newsletter",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/newsletter/contacts" },
  title: "Add a newsletter contact",
  description: "Adds a contact to one or more newsletter lists.",
  input: z.object({ email: z.string().email(), firstName: z.string().optional(), lastName: z.string().optional(), listIds: z.array(z.string()).min(1) }),
  output: z.object({ success: z.literal(true) }),
  handler: async (ctx, input) => {
    const resend = await requireResend(ctx.principal.userId);
    const { error } = await resend.contacts.create({
      email: input.email.trim(),
      firstName: input.firstName?.trim() || undefined,
      lastName: input.lastName?.trim() || undefined,
      unsubscribed: false,
      segments: input.listIds.map((id) => ({ id })),
    });
    if (error) throw new OpValidationError(error.message);
    return { success: true } as const;
  },
});

export const newsletterRemoveContact = defineOperation({
  id: "newsletter.removeContact",
  tool: "newsletter_remove_contact",
  module: "newsletter",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/newsletter/contacts/:contactId/remove" },
  title: "Remove a newsletter contact from a list",
  description: "Removes a contact from one list (not from Resend entirely — just that list's segment).",
  input: z.object({ contactId: z.string(), listId: z.string() }),
  output: z.object({ success: z.literal(true) }),
  handler: async (ctx, input) => {
    const resend = await requireResend(ctx.principal.userId);
    const { error } = await resend.contacts.segments.remove({ contactId: input.contactId, segmentId: input.listId });
    if (error) throw new OpValidationError(error.message);
    return { success: true } as const;
  },
});

export const newsletterWriteOperations = [newsletterCreateList, newsletterAddContact, newsletterRemoveContact];
