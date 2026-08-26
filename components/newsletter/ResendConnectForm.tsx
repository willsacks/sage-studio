"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Mail, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setResendConnection, disconnectResend } from "@/lib/actions/newsletter";

type Props = {
  isConnected: boolean;
};

/** Lets a user connect their OWN Resend account (once, for their whole
 * account — not per-site) so the Newsletter page can manage lists/contacts
 * and send broadcasts through it, and so captured emails (from
 * EmailGateBlock downloads and page gates, on whichever sites they choose
 * to feed a list) sync there too. Sage Studio never sends on their behalf
 * — this is their own account, their own sending domain. Mirrors
 * NotificationEmailForm's inline save/error/success pattern. */
export function ResendConnectForm({ isConnected }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleConnect() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await setResendConnection(apiKey);
        if (result.error) {
          setError(result.error);
        } else {
          setSaved(true);
          setApiKey("");
          router.refresh();
          setTimeout(() => setSaved(false), 3000);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function handleDisconnect() {
    setError(null);
    startTransition(async () => {
      const result = await disconnectResend();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (isConnected) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <Mail size={15} className="text-[var(--muted-foreground)] flex-shrink-0 mt-2" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--foreground)] mb-1.5 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-green-500" />
            Resend connected
          </p>
          <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={isPending} className="h-8">
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
            <span className="ml-1.5">Disconnect</span>
          </Button>
          {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <Mail size={16} className="text-[var(--muted-foreground)] flex-shrink-0 mt-2" />
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-sm font-medium text-[var(--foreground)]">
          Connect Resend to send updates and grow your list
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Manage your contacts and lists here, and send broadcasts straight
          from Sage Studio — through your own Resend account, so you own the
          list and the sending domain.
        </p>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Resend API key"
          className="h-8 text-sm max-w-sm"
        />
        <Button
          size="sm"
          onClick={handleConnect}
          disabled={isPending || !apiKey.trim()}
          className="h-8"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : null}
          <span className="ml-1.5">{saved ? "Connected" : "Connect"}</span>
        </Button>
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      </div>
    </div>
  );
}
