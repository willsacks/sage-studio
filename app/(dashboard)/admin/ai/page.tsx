import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canManagePlatform } from "@/lib/access/platform-access";
import { AiPromptEditor } from "@/components/admin/AiPromptEditor";
import { AiModelSelector } from "@/components/admin/AiModelSelector";
import { getAiPrompts, getAiModel } from "@/lib/actions/admin";
import { DEFAULT_SYSTEM_BLOCK, DEFAULT_SYSTEM_HTML } from "@/lib/ai/prompts";

export const metadata: Metadata = { title: "AI Settings — Admin" };

export default async function AdminAiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canManagePlatform(profile?.role)) redirect("/admin/users");

  const [aiPrompts, aiModel] = await Promise.all([getAiPrompts(), getAiModel()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BrainCircuit size={22} /> AI Settings
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Global settings for the AI page-editing assistant. Per-user access toggles live on each user's account page.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Model</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Which Claude model the AI assistant uses when editing pages. Takes effect on the next AI request, no deploy needed.
        </p>
        <AiModelSelector currentModel={aiModel} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Prompt</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          The system prompt the AI assistant uses when editing pages — one for the block editor, one for the HTML editor.
        </p>
        <AiPromptEditor
          initialBlockPrompt={aiPrompts.blockPrompt}
          initialHtmlPrompt={aiPrompts.htmlPrompt}
          defaultBlockPrompt={DEFAULT_SYSTEM_BLOCK}
          defaultHtmlPrompt={DEFAULT_SYSTEM_HTML}
        />
      </section>
    </div>
  );
}
