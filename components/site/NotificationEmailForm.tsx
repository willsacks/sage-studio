"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setNotificationEmail } from "@/lib/actions/sites";

type Props = {
  siteId: string;
  currentEmail: string | null;
};

export function NotificationEmailForm({ siteId, currentEmail }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState(currentEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setNotificationEmail(siteId, email);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <div className="flex items-start gap-2 mb-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <Mail size={15} className="text-[var(--muted-foreground)] flex-shrink-0 mt-2" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--foreground)] mb-1.5">Email me for new submissions</p>
        <div className="flex items-center gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            placeholder="you@example.com"
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleSave} disabled={isPending} className="h-8 flex-shrink-0">
            {isPending ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : "Save"}
          </Button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      </div>
    </div>
  );
}
