import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getResendClientForUser } from "@/lib/email/resend-client";
import { ResendConnectForm } from "@/components/newsletter/ResendConnectForm";
import { NewsletterApp } from "@/components/newsletter/NewsletterApp";

export const metadata: Metadata = { title: "Newsletter" };

export default async function NewsletterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const resend = await getResendClientForUser(user.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail size={22} /> Newsletter
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Manage your contacts and send updates to your list, across all your sites.
        </p>
      </div>

      {!resend ? (
        <ResendConnectForm isConnected={false} />
      ) : (
        <>
          <ResendConnectForm isConnected={true} />
          <NewsletterApp />
        </>
      )}
    </div>
  );
}
