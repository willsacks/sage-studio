"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enrollStudentByEmail, removeEnrollment } from "@/lib/actions/enrollments";
import type { StudentProgressRow } from "@/lib/queries/courses";

export function EnrollmentsManager({
  courseId,
  students,
  coursePriceCents,
}: {
  courseId: string;
  students: StudentProgressRow[];
  coursePriceCents: number | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [priceDollars, setPriceDollars] = useState(coursePriceCents ? (coursePriceCents / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleInvite() {
    if (!email.trim()) return;
    setError(null);
    const parsed = parseFloat(priceDollars);
    const priceCents = priceDollars.trim() === "" ? 0 : (Number.isFinite(parsed) ? Math.round(parsed * 100) : coursePriceCents ?? 0);
    startTransition(async () => {
      const result = await enrollStudentByEmail(courseId, email, priceCents);
      if ("error" in result) { setError(result.error ?? "Failed to enroll student"); return; }
      setEmail("");
      router.refresh();
    });
  }

  function handleRemove(enrollmentId: string) {
    if (!confirm("Remove this student's access to the course?")) return;
    startTransition(async () => { await removeEnrollment(enrollmentId, courseId); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@example.com"
          className="max-w-xs"
          onKeyDown={(e) => e.key === "Enter" && handleInvite()}
        />
        {coursePriceCents ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-[var(--muted-foreground)]">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              className="w-24 h-9"
              title="Price this student pays — lower it for a discount, or clear it to comp them free"
            />
          </div>
        ) : (
          <span className="text-xs text-[var(--muted-foreground)]">Free course</span>
        )}
        <Button size="sm" onClick={handleInvite} disabled={isPending || !email.trim()}>
          {isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <UserPlus size={13} className="mr-1.5" />}
          Enroll student
        </Button>
      </div>
      {coursePriceCents ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          Course price is ${(coursePriceCents / 100).toFixed(2)} — lower the amount above to discount this student, or clear it to give them free access.
        </p>
      ) : null}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {students.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">No students enrolled yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {students.map((s) => {
            const pct = s.totalLessons > 0 ? Math.round((s.completedCount / s.totalLessons) * 100) : 0;
            return (
              <div key={s.enrollmentId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm flex-1 truncate">{s.email}</span>
                {coursePriceCents ? (
                  <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">
                    {!s.pricePaidCents ? "Comped" : `$${(s.pricePaidCents / 100).toFixed(2)}`}
                    {s.invoiceId && " · invoiced"}
                  </span>
                ) : null}
                {s.status === "accepted" && s.totalLessons > 0 && (
                  <span className="text-xs text-[var(--muted-foreground)] w-32 flex-shrink-0">
                    {s.completedCount}/{s.totalLessons} lessons ({pct}%)
                  </span>
                )}
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    s.status === "accepted" ? "bg-green-100 text-green-700" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {s.status === "accepted" ? "Active" : "Pending — awaiting first login"}
                </span>
                <button onClick={() => handleRemove(s.enrollmentId)} className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
