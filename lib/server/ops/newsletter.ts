import { z } from "zod";
import { defineOperation, OpValidationError } from "@/lib/server/contract/operation";
import { getResendClientForUser } from "@/lib/email/resend-client";

/** Newsletter data isn't in Sage Studio's own database at all — lists,
 * contacts, domains, and broadcasts are all Resend API resources,
 * fetched live via the user's own connected Resend account (see
 * lib/email/resend-client.ts). Every handler below calls Resend
 * directly and never touches ctx.db. Deliberately NOT exposed anywhere
 * in this module: sending a broadcast (a real, irreversible email to
 * real people — the same "no money movement" reasoning that kept
 * finance write tools away from anything Stripe-related), connecting/
 * disconnecting the Resend API key itself, and adding/verifying/
 * removing a sending domain (DNS-affecting, no real assistant use
 * case). Those stay human-only, in the app's own Newsletter page. */
async function requireResend(userId: string) {
  const resend = await getResendClientForUser(userId);
  if (!resend) throw new OpValidationError("Connect Resend first, in Settings → Newsletter.");
  return resend;
}

export const newsletterListLists = defineOperation({
  id: "newsletter.listLists",
  tool: "newsletter_list_lists",
  module: "newsletter",
  minScope: "read",
  http: { method: "GET", path: "/newsletter/lists" },
  title: "List newsletter lists",
  description: "Lists the user's Resend audiences (newsletter lists).",
  input: z.object({}),
  output: z.object({ items: z.array(z.object({ id: z.string(), name: z.string() })) }),
  handler: async (ctx) => {
    const resend = await requireResend(ctx.principal.userId);
    const { data, error } = await resend.audiences.list();
    if (error) throw new OpValidationError(error.message);
    return { items: (data?.data ?? []).map((a) => ({ id: a.id, name: a.name })) };
  },
});

export const newsletterListContacts = defineOperation({
  id: "newsletter.listContacts",
  tool: "newsletter_list_contacts",
  module: "newsletter",
  minScope: "read",
  http: { method: "GET", path: "/newsletter/contacts" },
  title: "List newsletter contacts",
  description: "Lists contacts on one list (pass listId), or every contact across every list, deduped by email, if omitted.",
  input: z.object({ listId: z.string().optional() }),
  output: z.object({ items: z.array(z.object({ id: z.string(), email: z.string(), firstName: z.string().nullable(), lastName: z.string().nullable(), unsubscribed: z.boolean() })) }),
  handler: async (ctx, input) => {
    const resend = await requireResend(ctx.principal.userId);
    if (input.listId) {
      const { data, error } = await resend.contacts.list({ segmentId: input.listId });
      if (error) throw new OpValidationError(error.message);
      return { items: (data?.data ?? []).map((c) => ({ id: c.id, email: c.email, firstName: c.first_name ?? null, lastName: c.last_name ?? null, unsubscribed: c.unsubscribed })) };
    }
    const { data: listsData, error: listsError } = await resend.audiences.list();
    if (listsError) throw new OpValidationError(listsError.message);
    const seen = new Map<string, { id: string; email: string; firstName: string | null; lastName: string | null; unsubscribed: boolean }>();
    for (const list of listsData?.data ?? []) {
      const { data } = await resend.contacts.list({ segmentId: list.id });
      for (const c of data?.data ?? []) {
        if (!seen.has(c.email)) seen.set(c.email, { id: c.id, email: c.email, firstName: c.first_name ?? null, lastName: c.last_name ?? null, unsubscribed: c.unsubscribed });
      }
    }
    return { items: [...seen.values()] };
  },
});

export const newsletterListDomains = defineOperation({
  id: "newsletter.listDomains",
  tool: "newsletter_list_domains",
  module: "newsletter",
  minScope: "read",
  http: { method: "GET", path: "/newsletter/domains" },
  title: "List newsletter sending domains",
  description: "Lists the user's connected sending domains and their verification status. Read-only — adding or verifying a domain stays in the app itself.",
  input: z.object({}),
  output: z.object({ items: z.array(z.object({ id: z.string(), name: z.string(), status: z.string() })) }),
  handler: async (ctx) => {
    const resend = await requireResend(ctx.principal.userId);
    const { data, error } = await resend.domains.list();
    if (error) throw new OpValidationError(error.message);
    return { items: (data?.data ?? []).map((d) => ({ id: d.id, name: d.name, status: d.status })) };
  },
});

export const newsletterListBroadcasts = defineOperation({
  id: "newsletter.listBroadcasts",
  tool: "newsletter_list_broadcasts",
  module: "newsletter",
  minScope: "read",
  http: { method: "GET", path: "/newsletter/broadcasts" },
  title: "List recent newsletter broadcasts",
  description: "Lists recently sent/drafted broadcasts (name, status, dates — not the full content, call newsletter_get_broadcast for that).",
  input: z.object({}),
  output: z.object({ items: z.array(z.object({ id: z.string(), name: z.string(), status: z.string() })) }),
  handler: async (ctx) => {
    const resend = await requireResend(ctx.principal.userId);
    const { data, error } = await resend.broadcasts.list();
    if (error) throw new OpValidationError(error.message);
    return { items: (data?.data ?? []).map((b) => ({ id: b.id, name: b.name ?? "Untitled", status: b.status })) };
  },
});

export const newsletterGetBroadcast = defineOperation({
  id: "newsletter.getBroadcast",
  tool: "newsletter_get_broadcast",
  module: "newsletter",
  minScope: "read",
  http: { method: "GET", path: "/newsletter/broadcasts/:id" },
  title: "Get a newsletter broadcast",
  description: "Gets one broadcast's full content (subject and HTML body).",
  input: z.object({ id: z.string() }),
  output: z.object({ id: z.string(), subject: z.string().nullable(), html: z.string().nullable(), status: z.string() }),
  handler: async (ctx, input) => {
    const resend = await requireResend(ctx.principal.userId);
    const { data, error } = await resend.broadcasts.get(input.id);
    if (error) throw new OpValidationError(error.message);
    if (!data) throw new Error("not_found");
    return { id: data.id, subject: data.subject ?? null, html: data.html ?? null, status: data.status };
  },
});

export const newsletterOperations = [newsletterListLists, newsletterListContacts, newsletterListDomains, newsletterListBroadcasts, newsletterGetBroadcast];
