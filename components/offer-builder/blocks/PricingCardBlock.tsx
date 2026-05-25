"use client";

import { useState } from "react";
import type { PricingCardBlockData, PricingTier } from "@/lib/types/builder";

const CARD_WIDTHS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" } as const;

// Scale factor by column count so text stays comfortable as more cards are added
const COL_SCALE: Record<number, number> = { 1: 1, 2: 0.88, 3: 0.78, 4: 0.68 };

/** Normalise legacy flat-field blocks into the tiers array format. */
function getTiers(data: PricingCardBlockData): PricingTier[] {
  if (data.tiers && data.tiers.length > 0) return data.tiers;
  return [{
    id: "legacy",
    heading: data.heading,
    badge: data.badge,
    imageUrl: data.imageUrl,
    imageFocusX: data.imageFocusX,
    imageFocusY: data.imageFocusY,
    price: data.price ?? "",
    originalPrice: data.originalPrice,
    period: data.period,
    description: data.description,
    features: data.features ?? [],
    featureIcon: data.featureIcon,
    ctaText: data.ctaText ?? "Get Started",
    ctaLink: data.ctaLink,
    secondaryCtaText: data.secondaryCtaText,
    secondaryCtaLink: data.secondaryCtaLink,
    guarantee: data.guarantee,
    stripePriceId: data.stripePriceId,
    stripeMode: data.stripeMode,
    highlight: data.highlight,
    buttonStyle: data.buttonStyle,
  }];
}

function TierCard({ tier, isEditing, scale = 1, useSubgrid = false }: {
  tier: PricingTier;
  isEditing?: boolean;
  scale?: number;
  useSubgrid?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handleStripeCheckout(e: React.MouseEvent) {
    if (isEditing || !tier.stripePriceId) return;
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: tier.stripePriceId, mode: tier.stripeMode ?? "payment" }),
      });
      const json = await res.json() as { url?: string };
      if (json.url) window.location.href = json.url;
    } catch {
      if (tier.ctaLink) window.location.href = tier.ctaLink;
    } finally {
      setLoading(false);
    }
  }

  const ctaHref = tier.ctaLink ?? "#";
  const ctaHandler = tier.stripePriceId && !isEditing
    ? handleStripeCheckout
    : isEditing ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  const icon = tier.featureIcon || "✓";
  const isOutline = tier.buttonStyle === "outline";

  const subgridSpan: React.CSSProperties = useSubgrid
    ? { gridRow: "span 4", display: "grid", gridTemplateRows: "subgrid", gap: 0 }
    : {};

  return (
    <div
      className="relative"
      style={useSubgrid
        ? subgridSpan
        : { display: "flex", flexDirection: "column", height: "100%" }
      }
    >
      {tier.badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <span
            className="px-4 py-1 text-xs font-bold tracking-wider uppercase whitespace-nowrap"
            style={{
              backgroundColor: "var(--st-color-accent, #C9A84C)",
              color: "var(--st-color-text-inverse, #0E0C09)",
              borderRadius: "9999px",
            }}
          >
            {tier.badge}
          </span>
        </div>
      )}

      <div
        className="overflow-hidden"
        style={{
          ...(useSubgrid
            ? subgridSpan
            : { display: "flex", flexDirection: "column", height: "100%" }
          ),
          backgroundColor: "var(--st-color-surface, #1A1712)",
          border: tier.highlight
            ? "2px solid var(--st-color-accent, #C9A84C)"
            : "1px solid var(--st-color-border, rgba(201,168,76,0.2))",
          borderRadius: "var(--st-border-radius, 2px)",
          boxShadow: tier.highlight
            ? "0 0 40px color-mix(in srgb, var(--st-color-accent, #C9A84C) 15%, transparent)"
            : undefined,
        }}
      >
        {/* Row 1: image — always rendered so subgrid rows stay consistent */}
        <div
          className="w-full flex-shrink-0"
          style={{ height: tier.imageUrl ? "180px" : 0, overflow: "hidden" }}
        >
          {tier.imageUrl && (
            <img
              src={tier.imageUrl}
              alt={tier.heading ?? ""}
              className="w-full h-full object-cover"
              style={{ objectPosition: `${tier.imageFocusX ?? 50}% ${tier.imageFocusY ?? 50}%` }}
            />
          )}
        </div>

        {/* Row 2: heading / price / description — separator aligns here */}
        <div
          className="px-6 pt-8 pb-6 text-center flex-shrink-0"
          style={{ borderBottom: "1px solid var(--st-color-border, rgba(138,128,112,0.15))" }}
        >
          {tier.heading && (
            <h3
              className="font-bold mb-4 cc-tier-heading"
              style={{
                fontSize: `${1.25 * scale}rem`,
                color: "var(--st-color-text, #F5F0E8)",
                fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
              }}
            >
              {tier.heading}
            </h3>
          )}

          <div className="flex items-end justify-center gap-2 mb-1">
            {tier.originalPrice && (
              <span className="mb-1 line-through" style={{ fontSize: `${1 * scale}rem`, color: "var(--st-color-text-muted, #8A8070)" }}>
                {tier.originalPrice}
              </span>
            )}
            <span
              className="font-bold leading-none cc-tier-price"
              style={{
                fontSize: `clamp(${1.5 * scale}rem, ${6 * scale}vw, ${3 * scale}rem)`,
                color: "var(--st-color-accent, #C9A84C)",
                fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
              }}
            >
              {tier.price}
            </span>
            {tier.period && (
              <span className="mb-1 text-sm" style={{ color: "var(--st-color-text-muted, #8A8070)" }}>
                /{tier.period}
              </span>
            )}
          </div>

          {tier.description && (
            <div
              className="text-sm leading-relaxed mt-3 offer-text-prose"
              style={{ color: "var(--st-color-text-muted, #C8BFB0)" }}
              dangerouslySetInnerHTML={{ __html: tier.description }}
            />
          )}
        </div>

        {/* Row 3: features — always rendered so subgrid rows stay consistent */}
        <div className={useSubgrid ? "px-6 py-5" : "px-6 py-5 flex-1"}>
          {tier.features.length > 0 && (
            <ul className="space-y-2.5">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 mt-0.5 text-sm leading-none" style={{ color: "var(--st-color-accent, #C9A84C)" }} aria-hidden="true">
                    {icon}
                  </span>
                  <span className="text-sm leading-snug" style={{ color: "var(--st-color-text-muted, #C8BFB0)" }}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Row 4: CTA — extra bottom padding provides spacing between wrapping card rows */}
        <div className={useSubgrid ? "px-6 pt-2 pb-10 flex-shrink-0" : "px-6 pb-6 flex-shrink-0"}>
          <a
            href={ctaHref}
            onClick={ctaHandler}
            className="block w-full text-center px-5 py-3 font-bold text-sm transition-all hover:opacity-90 active:opacity-80"
            style={{
              ...(isOutline ? {
                backgroundColor: "transparent",
                color: "var(--st-color-accent, #C9A84C)",
                border: "2px solid var(--st-color-accent, #C9A84C)",
              } : {
                backgroundColor: "var(--st-color-accent, #C9A84C)",
                color: "var(--st-color-text-inverse, #0E0C09)",
                border: "2px solid transparent",
              }),
              borderRadius: "var(--st-border-radius-button, 2px)",
              fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
              textTransform: "var(--st-button-text-transform, uppercase)" as React.CSSProperties["textTransform"],
              letterSpacing: "var(--st-button-letter-spacing, 0.05em)",
              opacity: loading ? 0.7 : 1,
              pointerEvents: loading ? "none" : undefined,
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Processing...
              </span>
            ) : tier.ctaText}
          </a>

          {tier.secondaryCtaText && (
            <a
              href={tier.secondaryCtaLink ?? "#"}
              onClick={isEditing ? (e) => e.preventDefault() : undefined}
              className="block w-full text-center text-sm mt-2.5 transition-opacity hover:opacity-70"
              style={{ color: "var(--st-color-text-muted, #8A8070)", textDecoration: "underline", textUnderlineOffset: "3px" }}
            >
              {tier.secondaryCtaText}
            </a>
          )}

          {tier.stripePriceId && !isEditing && (
            <p className="text-center text-[10px] mt-1.5" style={{ color: "var(--st-color-text-muted, #8A8070)" }}>
              Secure checkout via Stripe
            </p>
          )}

          {tier.guarantee && (
            <p className="text-center text-xs mt-3 leading-relaxed" style={{ color: "var(--st-color-text-muted, #8A8070)" }}>
              {tier.guarantee}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PricingCardBlock({ data, isEditing }: { data: PricingCardBlockData; isEditing?: boolean }) {
  const tiers = getTiers(data);
  const count = tiers.length;
  const isLeft = data.layout === "left";

  const gridCols = count === 1 ? 1 : count <= 3 ? count : count === 4 ? 4 : 3;
  const scale = COL_SCALE[gridCols] ?? 0.78;

  return (
    <section
      className="w-full px-8 py-16"
      style={{ backgroundColor: "var(--st-color-background, #0E0C09)", containerType: "inline-size" } as React.CSSProperties}
    >
      <div style={{ maxWidth: "var(--st-container-max-width, 1200px)", margin: "0 auto" }}>

        {(data.sectionHeading || data.sectionSubheading) && (
          <div className={`mb-10 ${isLeft ? "" : "text-center"}`}>
            {data.sectionHeading && (
              <h2
                className="font-bold"
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                  color: "var(--st-color-text, #F5F0E8)",
                  fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
                  fontWeight: "var(--st-font-display-weight, 700)",
                  letterSpacing: "var(--st-letter-spacing-display, -0.02em)",
                }}
              >
                {data.sectionHeading}
              </h2>
            )}
            {data.sectionSubheading && (
              <p
                className="mt-3 text-lg"
                style={{
                  color: "var(--st-color-text-muted, #C8BFB0)",
                  fontFamily: `var(--st-font-body, "Cormorant Garamond"), serif`,
                  lineHeight: "var(--st-line-height-body, 1.6)",
                }}
              >
                {data.sectionSubheading}
              </p>
            )}
          </div>
        )}

        {count === 1 ? (
          <div className={`${CARD_WIDTHS[data.cardWidth ?? "md"]} ${isLeft ? "" : "mx-auto"} relative pt-4`}>
            <TierCard tier={tiers[0]} isEditing={isEditing} scale={scale} />
          </div>
        ) : (
          // column-gap only — row-gap is 0 so subgrid rows share heights without added gaps
          // On narrow containers cards stack to a single column via @container query
          <>
            <style>{`
              @container (max-width: 600px) {
                .cc-pricing-grid { grid-template-columns: 1fr !important; row-gap: 1.5rem !important; }
                .cc-pricing-card { grid-row: auto !important; display: block !important; }
                .cc-pricing-card .cc-tier-heading { font-size: 1.25rem !important; }
                .cc-pricing-card .cc-tier-price { font-size: clamp(2rem, 6vw, 3rem) !important; }
              }
            `}</style>
            <div
              className="grid pt-4 cc-pricing-grid"
              style={{
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                columnGap: "1.5rem",
                rowGap: 0,
              }}
            >
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className="relative pt-4 cc-pricing-card"
                  style={{ gridRow: "span 4", display: "grid", gridTemplateRows: "subgrid", gap: 0 }}
                >
                  <TierCard tier={tier} isEditing={isEditing} scale={scale} useSubgrid />
                </div>
              ))}
            </div>
          </>
        )}

        {data.footerText && (
          <p
            className="mt-8 text-sm leading-relaxed"
            style={{
              color: "var(--st-color-text-muted, #8A8070)",
              fontFamily: `var(--st-font-body, "Cormorant Garamond"), serif`,
              textAlign: isLeft ? "left" : "center",
            }}
          >
            {data.footerText}
          </p>
        )}
      </div>
    </section>
  );
}
