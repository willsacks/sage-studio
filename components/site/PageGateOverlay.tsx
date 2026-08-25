"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";

interface PageGateOverlayProps {
  siteSlug: string;
  pageId: string;
  isUnlocked: boolean;
  gateTitle: string | null;
  gateDescription: string | null;
  gateButtonText: string | null;
  children: React.ReactNode;
}

/**
 * Wraps a page's real rendered content (block-based or the HTML iframe —
 * the caller doesn't need to know which) and, when not yet unlocked,
 * blurs it behind a scrim + email-capture card. This is a SOFT gate: the
 * real content is present in the response HTML the whole time, just
 * visually blurred and non-interactive — it's meant to entice entry with a
 * teaser, not protect confidential content. `isUnlocked` is computed
 * server-side (a cookie check in the page route) so there's no flash of
 * blurred-then-unblurred content on load.
 */
export function PageGateOverlay({
  siteSlug,
  pageId,
  isUnlocked,
  gateTitle,
  gateDescription,
  gateButtonText,
  children,
}: PageGateOverlayProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/page-gate-unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteSlug, pageId, email }),
        });
        const result = await res.json() as { ok?: boolean; error?: string };
        if (!res.ok || result.error) {
          setError(result.error ?? "Something went wrong. Please try again.");
          return;
        }
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  if (isUnlocked) return <>{children}</>;

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <div
        style={{
          filter: "blur(20px)",
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        aria-hidden="true"
      >
        {children}
      </div>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "rgba(20, 20, 20, 0.45)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "#fff",
            borderRadius: "16px",
            padding: "36px 32px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#f3f0ea",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
            }}
          >
            <Mail size={20} color="#555" />
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "10px", color: "#1a1a1a" }}>
            {gateTitle || "Enter your email to continue"}
          </h2>
          {gateDescription && (
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "22px", lineHeight: 1.6 }}>
              {gateDescription}
            </p>
          )}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #ddd",
                fontSize: "14px",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#1a1a1a",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 500,
                cursor: isPending ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {gateButtonText || "Unlock"}
            </button>
          </form>
          {error && <p style={{ color: "#c0392b", fontSize: "13px", marginTop: "10px" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
