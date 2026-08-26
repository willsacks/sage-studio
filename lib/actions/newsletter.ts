"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getResendClientForUser } from "@/lib/email/resend-client";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

async function requireResendClient(userId: string) {
  const resend = await getResendClientForUser(userId);
  if (!resend) throw new Error("Connect Resend first");
  return resend;
}

/**
 * Account-level Resend connection + list/contact/broadcast management —
 * one connection per user, shared across all of that user's sites (an
 * artist with multiple sites wants to email "everybody" across all of
 * them, not manage a separate Resend account per site). Per-site
 * configuration (which list(s) a given site's captures feed into) lives
 * in lib/actions/sites.ts's setSiteResendLists instead.
 */

export async function setResendConnection(apiKey: string) {
  const { supabase, user } = await requireAuth();

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) return { error: "An API key is required" };

  // Validate against the live Resend API before persisting, so a typo'd
  // key is caught here rather than silently failing every future sync.
  // Wrapped in try/catch — the SDK can throw (network error, malformed
  // key) rather than resolving with {error}, and an uncaught throw here
  // would surface as an unhandled rejection in the client's
  // startTransition instead of the inline error message the UI expects.
  try {
    const { Resend } = await import("resend");
    const testClient = new Resend(trimmedKey);
    const { error: resendError } = await testClient.audiences.list();
    if (resendError) {
      return { error: `Couldn't verify that with Resend: ${resendError.message}` };
    }

    const { encryptSecret } = await import("@/lib/crypto");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ resend_api_key_encrypted: encryptSecret(trimmedKey) })
      .eq("id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/newsletter");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't connect to Resend. Please try again." };
  }
}

export async function disconnectResend() {
  const { supabase, user } = await requireAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ resend_api_key_encrypted: null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/newsletter");
  return { success: true };
}

export async function listNewsletterLists() {
  const { user } = await requireAuth();
  const resend = await getResendClientForUser(user.id);
  if (!resend) return { error: "Connect Resend first", lists: [] };

  const { data, error } = await resend.audiences.list();
  if (error) return { error: error.message, lists: [] };
  return { lists: data?.data ?? [] };
}

export async function createNewsletterList(name: string) {
  const { user } = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "A list name is required" };

  try {
    const resend = await requireResendClient(user.id);
    const { data, error } = await resend.audiences.create({ name: trimmed });
    if (error) return { error: error.message };
    revalidatePath("/newsletter");
    return { list: data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create list" };
  }
}

export async function listNewsletterContacts(listId?: string) {
  const { user } = await requireAuth();
  const resend = await getResendClientForUser(user.id);
  if (!resend) return { error: "Connect Resend first", contacts: [] };

  if (listId) {
    const { data, error } = await resend.contacts.list({ segmentId: listId });
    if (error) return { error: error.message, contacts: [] };
    return { contacts: data?.data ?? [] };
  }

  // No list specified — show everyone across every list, deduped by email
  // (the SDK only lists contacts scoped to one list at a time).
  const { data: listsData, error: listsError } = await resend.audiences.list();
  if (listsError) return { error: listsError.message, contacts: [] };

  const seen = new Map<string, NonNullable<Awaited<ReturnType<typeof resend.contacts.list>>["data"]>["data"][number]>();
  for (const list of listsData?.data ?? []) {
    const { data } = await resend.contacts.list({ segmentId: list.id });
    for (const contact of data?.data ?? []) {
      if (!seen.has(contact.email)) seen.set(contact.email, contact);
    }
  }
  return { contacts: [...seen.values()] };
}

export async function addNewsletterContact(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  listIds: string[];
}) {
  const { user } = await requireAuth();
  const email = params.email.trim();
  if (!email) return { error: "An email address is required" };
  if (params.listIds.length === 0) return { error: "Choose at least one list" };

  try {
    const resend = await requireResendClient(user.id);
    const { error } = await resend.contacts.create({
      email,
      firstName: params.firstName?.trim() || undefined,
      lastName: params.lastName?.trim() || undefined,
      unsubscribed: false,
      segments: params.listIds.map((id) => ({ id })),
    });
    if (error) return { error: error.message };
    revalidatePath("/newsletter");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add contact" };
  }
}

export async function removeNewsletterContact(contactId: string, listId: string) {
  const { user } = await requireAuth();
  try {
    const resend = await requireResendClient(user.id);
    const { error } = await resend.contacts.segments.remove({ contactId, segmentId: listId });
    if (error) return { error: error.message };
    revalidatePath("/newsletter");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to remove contact" };
  }
}

export async function listNewsletterDomains() {
  const { user } = await requireAuth();
  const resend = await getResendClientForUser(user.id);
  if (!resend) return { error: "Connect Resend first", domains: [] };

  const { data, error } = await resend.domains.list();
  if (error) return { error: error.message, domains: [] };
  return { domains: (data?.data ?? []).filter((d) => d.status === "verified") };
}

export async function sendNewsletterBroadcast(params: {
  listId: string;
  subject: string;
  html: string;
  fromEmail: string;
  fromName: string;
  scheduledAt?: string;
}) {
  const { user } = await requireAuth();
  if (!params.subject.trim()) return { error: "A subject is required" };
  if (!params.html.trim()) return { error: "The update can't be empty" };
  if (!params.fromEmail.trim()) return { error: "Choose a From address" };

  try {
    const resend = await requireResendClient(user.id);
    const { data, error } = await resend.broadcasts.create({
      segmentId: params.listId,
      from: `${params.fromName} <${params.fromEmail}>`,
      subject: params.subject,
      html: params.html,
      send: true,
      ...(params.scheduledAt ? { scheduledAt: params.scheduledAt } : {}),
    });
    if (error) return { error: error.message };
    revalidatePath("/newsletter");
    return { broadcastId: data?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send" };
  }
}

export async function listRecentBroadcasts() {
  const { user } = await requireAuth();
  const resend = await getResendClientForUser(user.id);
  if (!resend) return { error: "Connect Resend first", broadcasts: [] };

  const { data, error } = await resend.broadcasts.list();
  if (error) return { error: error.message, broadcasts: [] };
  return { broadcasts: data?.data ?? [] };
}
