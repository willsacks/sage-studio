import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, KeyRound, Trash2, Lock, FileText, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canManagePlatform } from "@/lib/access/platform-access";

export const metadata: Metadata = { title: "Legal — Admin" };

export default async function AdminLegalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canManagePlatform(profile?.role)) redirect("/admin/users");

  const docs = [
    { href: "/security", label: "Security Policy", icon: ShieldCheck },
    { href: "/access-controls", label: "Access Controls Policy", icon: KeyRound },
    { href: "/data-retention", label: "Data Retention Policy", icon: Trash2 },
    { href: "/privacy", label: "Privacy Policy", icon: Lock },
    { href: "/terms", label: "Terms of Service", icon: FileText },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck size={22} /> Legal & Compliance
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">Published policy documents.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {docs.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--accent)] transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <doc.icon size={15} className="text-[var(--muted-foreground)]" />
              {doc.label}
            </span>
            <ExternalLink size={13} className="text-[var(--muted-foreground)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
