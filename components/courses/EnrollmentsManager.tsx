"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enrollStudentByEmail, removeEnrollment } from "@/lib/actions/enrollments";
import type { Enrollment } from "@/lib/queries/courses";

export function EnrollmentsManager({ courseId, enrollments }: { courseId: string; enrollments: Enrollment[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleInvite() {
    if (!email.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await enrollStudentByEmail(courseId, email);
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
      <div className="flex items-center gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@example.com"
          className="max-w-xs"
          onKeyDown={(e) => e.key === "Enter" && handleInvite()}
        />
        <Button size="sm" onClick={handleInvite} disabled={isPending || !email.trim()}>
          {isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <UserPlus size={13} className="mr-1.5" />}
          Enroll student
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {enrollments.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">No students enrolled yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {enrollments.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm flex-1 truncate">{e.email}</span>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  e.status === "accepted" ? "bg-green-100 text-green-700" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                {e.status === "accepted" ? "Active" : "Pending — awaiting first login"}
              </span>
              <button onClick={() => handleRemove(e.id)} className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
