"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, Download, Mail } from "lucide-react";
import type { EmailGateBlockData } from "@/lib/types/builder";

function unlockStorageKey(blockId: string) {
  return `sage_gate_unlocked_${blockId}`;
}

export function EmailGateBlock({
  data,
  isEditing,
  siteSlug,
  blockId,
}: {
  data: EmailGateBlockData;
  isEditing?: boolean;
  siteSlug?: string;
  blockId?: string;
}) {
  const rememberUnlock = data.rememberUnlock ?? true;
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"gated" | "submitting" | "unlocked">("gated");
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing || !blockId || !rememberUnlock) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(unlockStorageKey(blockId))) {
      setPhase("unlocked");
    }
  }, [isEditing, blockId, rememberUnlock]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEditing || !data.filePath || !blockId) return;
    setError(null);
    setPhase("submitting");
    try {
      const res = await fetch("/api/gate-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteSlug, blockId, email }),
      });
      const result = await res.json() as { downloadUrl?: string; error?: string };
      if (!res.ok || result.error || !result.downloadUrl) {
        setError(result.error ?? "Something went wrong. Please try again.");
        setPhase("gated");
        return;
      }
      setDownloadUrl(result.downloadUrl);
      if (rememberUnlock && typeof window !== "undefined") {
        window.localStorage.setItem(unlockStorageKey(blockId), "1");
      }
      setPhase("unlocked");
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("gated");
    }
  }

  const showUnlocked = phase === "unlocked" && !isEditing;

  return (
    <section
      style={{
        padding: "72px 24px",
        textAlign: "center",
        backgroundColor: "var(--st-color-surface, #1A1712)",
        borderTop: "1px solid var(--st-color-border, rgba(201,168,76,0.15))",
        borderBottom: "1px solid var(--st-color-border, rgba(201,168,76,0.15))",
      }}
    >
      <div style={{ maxWidth: "440px", margin: "0 auto" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "var(--st-color-background, #0E0C09)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          {showUnlocked ? (
            <Download size={20} color="var(--st-color-accent, #C9A84C)" />
          ) : (
            <Lock size={20} color="var(--st-color-accent, #C9A84C)" />
          )}
        </div>

        {showUnlocked ? (
          <>
            <h3 style={{ fontSize: "1.4rem", color: "var(--st-color-text, #F5F1E8)", marginBottom: "10px" }}>
              {data.successHeading || "You're in!"}
            </h3>
            <p style={{ fontSize: "0.9rem", color: "var(--st-color-text-muted, #8A8070)", marginBottom: "24px" }}>
              {data.successMessage || "Thanks — here's your download."}
            </p>
            <a
              href={downloadUrl ?? "#"}
              download={data.fileName || undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 28px",
                borderRadius: "4px",
                background: "var(--st-color-accent, #C9A84C)",
                color: "#0E0C09",
                fontSize: "0.85rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <Download size={15} />
              {data.downloadButtonText || "Download Now"}
            </a>
          </>
        ) : (
          <>
            <h3 style={{ fontSize: "1.4rem", color: "var(--st-color-text, #F5F1E8)", marginBottom: "10px" }}>
              {data.title || "Get the free download"}
            </h3>
            {data.description && (
              <p style={{ fontSize: "0.9rem", color: "var(--st-color-text-muted, #8A8070)", marginBottom: "24px" }}>
                {data.description}
              </p>
            )}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ position: "relative" }}>
                <Mail
                  size={15}
                  style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--st-color-text-muted, #8A8070)" }}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isEditing}
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 38px",
                    borderRadius: "4px",
                    border: "1px solid var(--st-color-border, rgba(201,168,76,0.2))",
                    background: "var(--st-color-background, #0E0C09)",
                    color: "var(--st-color-text, #F5F1E8)",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isEditing || phase === "submitting"}
                style={{
                  padding: "12px 14px",
                  borderRadius: "4px",
                  border: "none",
                  background: "var(--st-color-accent, #C9A84C)",
                  color: "#0E0C09",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: isEditing ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {phase === "submitting" && <Loader2 size={14} className="animate-spin" />}
                {data.buttonText || "Send Me The Download"}
              </button>
            </form>
            {error && <p style={{ color: "#e07a5f", fontSize: "0.8rem", marginTop: "10px" }}>{error}</p>}
            {!data.filePath && isEditing && (
              <p style={{ color: "var(--st-color-text-muted, #8A8070)", fontSize: "0.75rem", marginTop: "12px" }}>
                Upload a file in the block settings to activate this gate.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
