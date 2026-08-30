"use server";

import { createClient } from "@/lib/supabase/server";

/** Whether the current user has opted into the Transactions tab's AI
 * categorization assistant — a separate flag from the site-editor's
 * ai_assistant_enabled, since this one mutates real financial data. */
export async function getAiFinanceAssistantEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("ai_finance_assistant_enabled").eq("id", user.id).maybeSingle();
  return data?.ai_finance_assistant_enabled ?? false;
}
