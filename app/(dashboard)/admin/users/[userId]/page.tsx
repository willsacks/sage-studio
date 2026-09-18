import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Globe, GraduationCap } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { canViewUserAccounts, canManagePlatform, isPlatformAdmin } from "@/lib/access/platform-access";
import { getUserDetail } from "@/lib/queries/admin";
import { RoleSelector, AiAccessToggles } from "@/components/admin/UserDetailControls";
import { DiscountForm } from "@/components/admin/DiscountForm";

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  const detail = await getUserDetail(userId);
  return { title: detail ? `${detail.display_name ?? detail.email} — Admin` : "User — Admin" };
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canViewUserAccounts(profile?.role)) redirect("/my-site");
  const canManage = canManagePlatform(profile?.role);
  const canEditRole = isPlatformAdmin(profile?.role);

  const detail = await getUserDetail(userId);
  if (!detail) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft size={14} /> Users
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{detail.display_name ?? detail.username ?? detail.email}</h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          {detail.email} · joined {format(new Date(detail.created_at), "MMM d, yyyy")}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--muted-foreground)]">Plan</span>
          <span className="text-sm font-medium">{detail.tier_key === "studio_pro" ? "Pro" : "Free"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--muted-foreground)]">Platform role</span>
          <RoleSelector userId={detail.id} initialRole={detail.role} canEdit={canEditRole} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--muted-foreground)]">AI assistant access</span>
          <AiAccessToggles
            userId={detail.id}
            initialSiteEnabled={detail.ai_assistant_enabled}
            initialFinanceEnabled={detail.ai_finance_assistant_enabled}
            canEdit={canManage}
          />
        </div>
        {canManage && (
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <span className="text-sm text-[var(--muted-foreground)]">Subscription discount</span>
            <DiscountForm userId={detail.id} currentPercent={detail.activeDiscountPercent} />
          </div>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1.5">
          <Globe size={13} /> Sites ({detail.sites.length})
        </h2>
        {detail.sites.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No sites.</p>
        ) : (
          <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
            {detail.sites.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{s.name}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{s.is_published ? "Published" : "Draft"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1.5">
          <GraduationCap size={13} /> Courses owned ({detail.ownedCourses.length})
        </h2>
        {detail.ownedCourses.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">None.</p>
        ) : (
          <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
            {detail.ownedCourses.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{c.title}</span>
                <span className="text-xs text-[var(--muted-foreground)] capitalize">{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1.5">
          <GraduationCap size={13} /> Enrolled in ({detail.enrolledCourses.length})
        </h2>
        {detail.enrolledCourses.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">None.</p>
        ) : (
          <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
            {detail.enrolledCourses.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{c.title}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
