import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_AI_MODEL } from "@/lib/ai/models";

/**
 * Reads the admin-configured model for an end-user-facing AI route (site
 * editor, finance categorization assistant). Deliberately NOT
 * lib/actions/admin.ts's getAiModel() — that Server Action gates on the
 * *caller* being an admin (it's meant for the /admin settings page to read
 * its own current value), so calling it from a route a regular member hits
 * throws "Not authorized" and 500s the whole request. platform_settings has
 * no RLS policies of its own, so reading it at all still requires the
 * service-role client — but that's a data-access requirement, not an
 * authorization check on who's asking, which this function correctly omits.
 *
 * Kept out of lib/ai/models.ts on purpose — that file's plain constants
 * (AVAILABLE_AI_MODELS, DEFAULT_AI_MODEL) are also imported by a Client
 * Component (components/admin/AiModelSelector.tsx). Adding this function's
 * `next/headers`-dependent import there broke the production build
 * ("You're importing a module that depends on next/headers ... in the Pages
 * Router") the moment that client component transitively pulled it in. */
export async function getPlatformAiModel(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from("platform_settings").select("ai_model").maybeSingle();
  return data?.ai_model || DEFAULT_AI_MODEL;
}
