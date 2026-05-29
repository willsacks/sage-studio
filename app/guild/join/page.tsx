"use client";

import React, { useState } from "react";

const GOLD = "#C9A84C";
const BG = "#0E0C09";
const SURFACE = "#1A1712";
const BORDER = "rgba(201,168,76,0.15)";
const TEXT = "#F5F0E8";
const MUTED = "#8A8070";

type PaymentType = "full" | "monthly";

const PACKAGES = [
  {
    key: "3mo",
    name: "3-Month Forge",
    months: 3,
    highlight: false,
    full: { key: "3mo-full", price: "$1,250", note: "one-time" },
    monthly: { key: "3mo-monthly", price: "$475", note: "/mo for 3 months" },
    features: ["Weekly group coaching calls", "Accountability partner pairing", "Private Guild community", "Monthly 1:1 check-in"],
  },
  {
    key: "6mo",
    name: "6-Month Forge",
    months: 6,
    highlight: true,
    full: { key: "6mo-full", price: "$2,100", note: "one-time" },
    monthly: { key: "6mo-monthly", price: "$400", note: "/mo for 6 months" },
    features: ["Everything in 3-Month", "Deeper creative transformation", "Extended accountability arc", "Access to Guild archives"],
  },
  {
    key: "12mo",
    name: "12-Month Forge",
    months: 12,
    highlight: false,
    full: { key: "12mo-full", price: "$3,750", note: "one-time" },
    monthly: { key: "12mo-monthly", price: "$350", note: "/mo for 12 months" },
    features: ["Everything in 6-Month", "Full year of creative momentum", "Priority access to new programs", "Lifetime Guild alumni status"],
  },
];

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 14, height: 14,
      border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "rgba(0,0,0,0.8)",
      borderRadius: "50%", animation: "guild-spin 0.7s linear infinite",
    }} />
  );
}

export default function GuildJoinPage() {
  const [paymentTypes, setPaymentTypes] = useState<Record<string, PaymentType>>({
    "3mo": "full", "6mo": "full", "12mo": "full",
  });
  const [loading, setLoading] = useState<string | null>(null);

  function togglePayment(key: string) {
    setPaymentTypes((prev) => ({ ...prev, [key]: prev[key] === "full" ? "monthly" : "full" }));
  }

  async function handleCheckout(packageKey: string) {
    if (loading) return;
    setLoading(packageKey);
    try {
      const res = await fetch("/api/guild-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageKey }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
      } else {
        setLoading(null);
      }
    } catch {
      setLoading(null);
    }
  }

  const btn = (key: string, label: string, variant: "primary" | "outline" = "primary"): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    padding: "0.875rem 2rem", border: "none", borderRadius: "2px", cursor: loading ? "default" : "pointer",
    fontFamily: `"Playfair Display", serif`, fontSize: "0.8rem", fontWeight: 700,
    letterSpacing: "0.12em", textTransform: "uppercase", transition: "opacity 0.2s", width: "100%",
    ...(variant === "primary"
      ? { backgroundColor: GOLD, color: "#0E0C09" }
      : { backgroundColor: "transparent", border: `1px solid rgba(201,168,76,0.4)`, color: GOLD }),
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap');
        @keyframes guild-spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: ${BG}; }
        .guild-forge-card:hover .guild-join-btn { opacity: 0.85; }
      `}</style>

      <main style={{ backgroundColor: BG, color: TEXT, minHeight: "100vh", fontFamily: `"Cormorant Garamond", serif` }}>

        {/* Header */}
        <section style={{ textAlign: "center", padding: "clamp(4rem,10vw,7rem) 1.5rem 3rem" }}>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", color: GOLD, textTransform: "uppercase", marginBottom: "1.5rem" }}>
            ✦ &nbsp; Will Sage &nbsp; ✦
          </p>
          <h1 style={{ fontFamily: `"Playfair Display", serif`, fontSize: "clamp(3rem,8vw,6rem)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: "1.5rem" }}>
            The Guild
          </h1>
          <p style={{ fontSize: "clamp(1rem,2.5vw,1.3rem)", color: MUTED, maxWidth: 560, margin: "0 auto", lineHeight: 1.7 }}>
            A coaching and accountability program for artists who are serious about their work — and their life.
          </p>
        </section>

        {/* Divider */}
        <div style={{ maxWidth: 80, margin: "0 auto 4rem", height: 1, backgroundColor: BORDER }} />

        {/* Guild Forge section */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p style={{ fontSize: "0.65rem", letterSpacing: "0.25em", color: GOLD, textTransform: "uppercase", marginBottom: "0.75rem" }}>
              Premium Program
            </p>
            <h2 style={{ fontFamily: `"Playfair Display", serif`, fontSize: "clamp(1.75rem,4vw,2.75rem)", fontWeight: 300 }}>
              Guild Forge
            </h2>
            <p style={{ color: MUTED, marginTop: "0.75rem", fontSize: "1rem", lineHeight: 1.7 }}>
              Deep work, real accountability, and a community of artists doing the same.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
            {PACKAGES.map((pkg) => {
              const pType = paymentTypes[pkg.key];
              const option = pType === "full" ? pkg.full : pkg.monthly;
              const isLoading = loading === option.key;

              return (
                <div
                  key={pkg.key}
                  className="guild-forge-card"
                  style={{
                    backgroundColor: SURFACE,
                    border: pkg.highlight ? `1px solid rgba(201,168,76,0.5)` : `1px solid ${BORDER}`,
                    padding: "2rem",
                    display: "flex", flexDirection: "column", gap: "1.5rem",
                    position: "relative",
                  }}
                >
                  {pkg.highlight && (
                    <div style={{
                      position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                      backgroundColor: GOLD, color: "#0E0C09", fontSize: "0.6rem",
                      fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase",
                      padding: "0.3rem 1rem",
                    }}>
                      Most Popular
                    </div>
                  )}

                  {/* Name */}
                  <div>
                    <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "0.4rem" }}>
                      {pkg.months} months
                    </p>
                    <h3 style={{ fontFamily: `"Playfair Display", serif`, fontSize: "1.4rem", fontWeight: 400 }}>
                      {pkg.name}
                    </h3>
                  </div>

                  {/* Toggle */}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {(["full", "monthly"] as PaymentType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setPaymentTypes((prev) => ({ ...prev, [pkg.key]: t }))}
                        style={{
                          flex: 1, padding: "0.4rem", fontSize: "0.7rem", fontWeight: 600,
                          letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                          border: `1px solid ${pType === t ? GOLD : BORDER}`,
                          backgroundColor: pType === t ? "rgba(201,168,76,0.12)" : "transparent",
                          color: pType === t ? GOLD : MUTED,
                          transition: "all 0.15s",
                        }}
                      >
                        {t === "full" ? "Pay in Full" : "Monthly"}
                      </button>
                    ))}
                  </div>

                  {/* Price */}
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
                      <span style={{ fontFamily: `"Playfair Display", serif`, fontSize: "2.25rem", fontWeight: 300 }}>
                        {option.price}
                      </span>
                      <span style={{ color: MUTED, fontSize: "0.85rem" }}>{option.note}</span>
                    </div>
                    {pType === "full" && (
                      <p style={{ fontSize: "0.72rem", color: MUTED, marginTop: "0.25rem" }}>
                        vs. {pkg.monthly.price}/mo &mdash; save by paying in full
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem", flex: 1 }}>
                    {pkg.features.map((f) => (
                      <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", fontSize: "0.9rem", color: MUTED, lineHeight: 1.5 }}>
                        <span style={{ color: GOLD, flexShrink: 0, marginTop: "0.1em" }}>✦</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    className="guild-join-btn"
                    style={btn(option.key, "Join Now")}
                    disabled={!!loading}
                    onClick={() => handleCheckout(option.key)}
                  >
                    {isLoading ? <Spinner /> : "Join Now →"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Divider */}
        <div style={{ maxWidth: 80, margin: "5rem auto 4rem", height: 1, backgroundColor: BORDER }} />

        {/* Guild Circle */}
        <section style={{ maxWidth: 600, margin: "0 auto", padding: "0 1.5rem 6rem" }}>
          <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, padding: "2.5rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.65rem", letterSpacing: "0.25em", color: MUTED, textTransform: "uppercase", marginBottom: "0.75rem" }}>
              Start Here
            </p>
            <h2 style={{ fontFamily: `"Playfair Display", serif`, fontSize: "clamp(1.5rem,4vw,2.25rem)", fontWeight: 300, marginBottom: "0.75rem" }}>
              Guild Circle
            </h2>
            <p style={{ color: MUTED, fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "1.75rem", maxWidth: 420, margin: "0 auto 1.75rem" }}>
              Community access, weekly check-ins, and accountability — the foundation of the Guild experience.
            </p>

            <div style={{ marginBottom: "1.75rem" }}>
              <span style={{ fontFamily: `"Playfair Display", serif`, fontSize: "2.25rem", fontWeight: 300 }}>$100</span>
              <span style={{ color: MUTED, fontSize: "0.9rem" }}> / month</span>
            </div>

            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem", textAlign: "left" }}>
              {["Private Guild community", "Weekly group accountability calls", "Monthly theme + creative challenges", "Cancel anytime"].map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", fontSize: "0.9rem", color: MUTED, lineHeight: 1.5 }}>
                  <span style={{ color: GOLD, flexShrink: 0 }}>✦</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              style={btn("circle", "Join Circle", "outline")}
              disabled={!!loading}
              onClick={() => handleCheckout("circle")}
            >
              {loading === "circle" ? <Spinner /> : "Join Guild Circle →"}
            </button>
          </div>
        </section>

      </main>
    </>
  );
}
