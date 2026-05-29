"use client";

import { useBuilderStore } from "@/lib/store/builder";
import { BLOCK_LABELS } from "@/lib/types/builder";
import type {
  HeroBlockData, TextBlockData, FeatureGridBlockData, TestimonialBlockData,
  PricingCardBlockData, PricingTier, ImageBlockData, ImageTextBlockData, GuaranteeBlockData,
  CTABannerBlockData, VideoEmbedBlockData, SpacerBlockData, DividerBlockData,
  CornerNavBlockData, SocialPlatform, ApplicationFormBlockData, FormField, FormFieldType,
  MusicEmbedBlockData, AlbumShowcaseBlockData, DiscographyBlockData, MusicPlatform,
  SimpleFormBlockData,
} from "@/lib/types/builder";
import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ImageUploader } from "@/components/ui/image-uploader";
import { VideoUploader } from "@/components/ui/video-uploader";
import { FocusPointPicker } from "@/components/ui/focus-point-picker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function HeroSettings({ data, update }: { data: HeroBlockData; update: (d: Partial<HeroBlockData>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Headline">
        <Textarea value={data.headline} onChange={(v) => update({ headline: v })} rows={2} />
      </Field>
      <Field label="Subheadline">
        <Textarea value={data.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} placeholder="Optional" />
      </Field>
      <Field label="Paragraph">
        <RichTextEditor content={data.paragraph ?? ""} onChange={(v) => update({ paragraph: v || undefined })} placeholder="Optional — appears below the subheadline with a decorative rule" />
      </Field>
      <Field label="CTA Button Text">
        <Input value={data.ctaText ?? ""} onChange={(v) => update({ ctaText: v })} placeholder="Get Started" />
      </Field>
      <Field label="CTA Link">
        <Input value={data.ctaLink ?? ""} onChange={(v) => update({ ctaLink: v })} placeholder="https://..." />
      </Field>
      {/* Background media — image or video */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">Background</label>
        {/* Image / Video tab toggle */}
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
          {(["image", "video"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update({ backgroundType: t })}
              className={cn(
                "flex-1 py-1.5 capitalize transition-colors",
                (data.backgroundType ?? "image") === t
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {(data.backgroundType ?? "image") === "image" ? (
          <div className="space-y-2">
            <ImageUploader
              bucket="offering-media"
              folder="hero-images"
              value={data.backgroundImage ?? null}
              onChange={(url) => update({ backgroundImage: url ?? undefined })}
              aspectRatio="video"
            />
            {data.backgroundImage && (
              <FocusPointPicker
                imageUrl={data.backgroundImage}
                focusX={data.backgroundFocusX ?? 50}
                focusY={data.backgroundFocusY ?? 50}
                onChange={(x, y) => update({ backgroundFocusX: x, backgroundFocusY: y })}
                aspectRatio="video"
              />
            )}
          </div>
        ) : (
          <VideoUploader
            value={data.backgroundVideo ?? null}
            onChange={(url) => update({ backgroundVideo: url ?? undefined })}
          />
        )}
      </div>
      <Field label="Height">
        <Select value={data.height ?? "lg"} onChange={(v) => update({ height: v as HeroBlockData["height"] })}
          options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }, { value: "full", label: "Full Screen" }]}
        />
      </Field>
      <Field label="Text Alignment">
        <Select value={data.textAlign ?? "center"} onChange={(v) => update({ textAlign: v as HeroBlockData["textAlign"] })}
          options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={data.overlay ?? false} onChange={(e) => update({ overlay: e.target.checked })} className="accent-[var(--primary)]" />
        Dark overlay on background
      </label>
    </div>
  );
}

function TextSettings({ data, update }: { data: TextBlockData; update: (d: Partial<TextBlockData>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Content">
        <RichTextEditor content={data.content} onChange={(v) => update({ content: v })} />
      </Field>
      <Field label="Alignment">
        <Select value={data.alignment ?? "left"} onChange={(v) => update({ alignment: v as TextBlockData["alignment"] })}
          options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={data.maxWidth ?? true} onChange={(e) => update({ maxWidth: e.target.checked })} className="accent-[var(--primary)]" />
        Constrain max width
      </label>
    </div>
  );
}

function FeatureGridSettings({ data, update }: { data: FeatureGridBlockData; update: (d: Partial<FeatureGridBlockData>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Section Heading">
        <Input value={data.heading ?? ""} onChange={(v) => update({ heading: v })} placeholder="Optional" />
      </Field>
      <Field label="Columns">
        <Select value={String(data.columns)} onChange={(v) => update({ columns: Number(v) as 2 | 3 | 4 })}
          options={[{ value: "2", label: "2 Columns" }, { value: "3", label: "3 Columns" }, { value: "4", label: "4 Columns" }]}
        />
      </Field>
      <div className="space-y-3">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">Features</p>
        {data.features.map((f, i) => (
          <div key={f.id} className="p-3 rounded-md border border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">Feature {i + 1}</span>
              <button onClick={() => update({ features: data.features.filter((_, j) => j !== i) })} className="text-[var(--muted-foreground)] hover:text-red-400">
                <Trash2 size={12} />
              </button>
            </div>
            <Input value={f.icon ?? ""} onChange={(v) => { const fs = [...data.features]; fs[i] = { ...fs[i], icon: v }; update({ features: fs }); }} placeholder="Icon (emoji or symbol)" />
            <Input value={f.title} onChange={(v) => { const fs = [...data.features]; fs[i] = { ...fs[i], title: v }; update({ features: fs }); }} placeholder="Title" />
            <Textarea value={f.description} onChange={(v) => { const fs = [...data.features]; fs[i] = { ...fs[i], description: v }; update({ features: fs }); }} rows={2} placeholder="Description" />
          </div>
        ))}
        <button
          onClick={() => update({ features: [...data.features, { id: crypto.randomUUID(), icon: "✦", title: "New Feature", description: "Description" }] })}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          <Plus size={12} /> Add Feature
        </button>
      </div>
    </div>
  );
}

function TestimonialSettings({ data, update }: { data: TestimonialBlockData; update: (d: Partial<TestimonialBlockData>) => void }) {
  function updateT(i: number, patch: Partial<(typeof data.testimonials)[0]>) {
    const ts = [...data.testimonials];
    ts[i] = { ...ts[i], ...patch };
    update({ testimonials: ts });
  }
  return (
    <div className="space-y-4">
      <Field label="Section Heading">
        <Input value={data.heading ?? ""} onChange={(v) => update({ heading: v })} placeholder="What People Are Saying" />
      </Field>
      <div className="space-y-3">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">Testimonials</p>
        {data.testimonials.map((t, i) => (
          <div key={t.id} className="p-3 rounded-md border border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">#{i + 1}</span>
              <button onClick={() => update({ testimonials: data.testimonials.filter((_, j) => j !== i) })} className="text-[var(--muted-foreground)] hover:text-red-400"><Trash2 size={12} /></button>
            </div>
            <RichTextEditor content={t.quote} onChange={(v) => updateT(i, { quote: v })} placeholder="Quote…" />
            <Input value={t.name} onChange={(v) => updateT(i, { name: v })} placeholder="Name" />
            <Input value={t.title ?? ""} onChange={(v) => updateT(i, { title: v })} placeholder="Title / Role (optional)" />
            <Field label="Avatar photo">
              <ImageUploader
                bucket="offering-media"
                folder="testimonial-avatars"
                value={t.avatar ?? null}
                onChange={(url) => updateT(i, { avatar: url ?? undefined })}
                aspectRatio="square"
              />
              {t.avatar && (
                <FocusPointPicker
                  imageUrl={t.avatar}
                  focusX={t.avatarFocusX ?? 50}
                  focusY={t.avatarFocusY ?? 50}
                  onChange={(x, y) => updateT(i, { avatarFocusX: x, avatarFocusY: y })}
                  aspectRatio="square"
                />
              )}
            </Field>
          </div>
        ))}
        <button
          onClick={() => update({ testimonials: [...data.testimonials, { id: crypto.randomUUID(), quote: "Add your testimonial here.", name: "Name", title: "Title" }] })}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          <Plus size={12} /> Add Testimonial
        </button>
      </div>
    </div>
  );
}

function legacyToTier(data: PricingCardBlockData): PricingTier {
  return {
    id: crypto.randomUUID(),
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
  };
}

function newTier(): PricingTier {
  return { id: crypto.randomUUID(), price: "", ctaText: "Get Started", features: [] };
}

function PricingSettings({ data, update }: { data: PricingCardBlockData; update: (d: Partial<PricingCardBlockData>) => void }) {
  const [activeTier, setActiveTier] = useState(0);

  const tiers: PricingTier[] = data.tiers?.length ? data.tiers : [legacyToTier(data)];
  const tier = tiers[Math.min(activeTier, tiers.length - 1)];

  function updateTiers(next: PricingTier[]) { update({ tiers: next }); }
  function updateTier(patch: Partial<PricingTier>) {
    const idx = Math.min(activeTier, tiers.length - 1);
    const next = [...tiers]; next[idx] = { ...next[idx], ...patch }; updateTiers(next);
  }
  function addTier() {
    if (tiers.length >= 5) return;
    updateTiers([...tiers, newTier()]);
    setActiveTier(tiers.length);
  }
  function removeTier() {
    if (tiers.length <= 1) return;
    const next = tiers.filter((_, i) => i !== activeTier);
    updateTiers(next);
    setActiveTier(Math.max(0, activeTier - 1));
  }

  return (
    <div className="space-y-4">

      {/* ── Section heading ── */}
      <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide pt-1">Section</p>
      <Field label="Heading"><Input value={data.sectionHeading ?? ""} onChange={(v) => update({ sectionHeading: v })} placeholder="Simple, transparent pricing" /></Field>
      <Field label="Subheading"><Input value={data.sectionSubheading ?? ""} onChange={(v) => update({ sectionSubheading: v })} placeholder="Optional tagline below heading" /></Field>
      <Field label="Footer Text"><Input value={data.footerText ?? ""} onChange={(v) => update({ footerText: v })} placeholder="e.g. All prices in USD. Cancel anytime." /></Field>
      <Field label="Layout">
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
          {(["center", "left"] as const).map((v) => (
            <button key={v} type="button" onClick={() => update({ layout: v })}
              className={cn("flex-1 py-1.5 capitalize transition-colors",
                (data.layout ?? "center") === v ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >{v}</button>
          ))}
        </div>
      </Field>
      {tiers.length === 1 && (
        <Field label="Card width">
          <Select value={data.cardWidth ?? "md"} onChange={(v) => update({ cardWidth: v as "sm" | "md" | "lg" })}
            options={[{ value: "sm", label: "Narrow" }, { value: "md", label: "Medium" }, { value: "lg", label: "Wide" }]}
          />
        </Field>
      )}

      {/* ── Tier tabs ── */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
            Pricing Tiers ({tiers.length})
          </p>
          {tiers.length < 5 && (
            <button onClick={addTier} className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1">
              <Plus size={11} /> Add tier
            </button>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {tiers.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActiveTier(i)}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition-colors",
                activeTier === i
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {t.heading ? t.heading.slice(0, 12) : `Tier ${i + 1}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Active tier fields ── */}
      <div key={tier.id} className="space-y-4 pt-1 border-t border-[var(--border)]">

        <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide pt-1">Card</p>
        <Field label="Card image">
          <ImageUploader bucket="offering-media" folder="pricing-images" value={tier.imageUrl ?? null}
            onChange={(url) => updateTier({ imageUrl: url ?? undefined })} aspectRatio="wide" />
          {tier.imageUrl && (
            <FocusPointPicker imageUrl={tier.imageUrl} focusX={tier.imageFocusX ?? 50} focusY={tier.imageFocusY ?? 50}
              onChange={(x, y) => updateTier({ imageFocusX: x, imageFocusY: y })} aspectRatio="wide" />
          )}
        </Field>
        <Field label="Plan name"><Input value={tier.heading ?? ""} onChange={(v) => updateTier({ heading: v })} /></Field>
        <Field label="Badge pill"><Input value={tier.badge ?? ""} onChange={(v) => updateTier({ badge: v })} placeholder="Most Popular" /></Field>

        <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide pt-1">Pricing</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Original price"><Input value={tier.originalPrice ?? ""} onChange={(v) => updateTier({ originalPrice: v || undefined })} placeholder="$497" /></Field>
          <Field label="Price"><Input value={tier.price} onChange={(v) => updateTier({ price: v })} placeholder="$297" /></Field>
        </div>
        <Field label="Period / billing"><Input value={tier.period ?? ""} onChange={(v) => updateTier({ period: v })} placeholder="one-time" /></Field>
        <Field label="Description"><RichTextEditor content={tier.description ?? ""} onChange={(v) => updateTier({ description: v })} /></Field>

        <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide pt-1">Features</p>
        <Field label="Check icon"><Input value={tier.featureIcon ?? ""} onChange={(v) => updateTier({ featureIcon: v || undefined })} placeholder="✓" /></Field>
        <div className="space-y-2">
          {tier.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={f} onChange={(e) => { const fs = [...tier.features]; fs[i] = e.target.value; updateTier({ features: fs }); }}
                className="flex-1 px-2 py-1.5 text-sm rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
              />
              <button onClick={() => updateTier({ features: tier.features.filter((_, j) => j !== i) })} className="text-[var(--muted-foreground)] hover:text-red-400"><Trash2 size={12} /></button>
            </div>
          ))}
          <button onClick={() => updateTier({ features: [...tier.features, "New feature"] })} className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"><Plus size={12} /> Add item</button>
        </div>

        <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide pt-1">Call to Action</p>
        <Field label="Button style">
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
            {(["solid", "outline"] as const).map((v) => (
              <button key={v} type="button" onClick={() => updateTier({ buttonStyle: v })}
                className={cn("flex-1 py-1.5 capitalize transition-colors",
                  (tier.buttonStyle ?? "solid") === v ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                )}
              >{v}</button>
            ))}
          </div>
        </Field>
        <Field label="Button text"><Input value={tier.ctaText} onChange={(v) => updateTier({ ctaText: v })} /></Field>
        <Field label="Button link"><Input value={tier.ctaLink ?? ""} onChange={(v) => updateTier({ ctaLink: v })} placeholder="https://..." /></Field>
        <Field label="Secondary link text"><Input value={tier.secondaryCtaText ?? ""} onChange={(v) => updateTier({ secondaryCtaText: v || undefined })} placeholder="No thanks" /></Field>
        <Field label="Secondary link URL"><Input value={tier.secondaryCtaLink ?? ""} onChange={(v) => updateTier({ secondaryCtaLink: v || undefined })} placeholder="https://..." /></Field>
        <Field label="Guarantee note"><Textarea value={tier.guarantee ?? ""} onChange={(v) => updateTier({ guarantee: v })} rows={2} placeholder="30-day money-back guarantee" /></Field>

        <div className="rounded-md border border-[var(--primary)]/30 p-3 space-y-3 bg-[var(--primary)]/5">
          <p className="text-[10px] font-semibold text-[var(--primary)] uppercase tracking-wide">Stripe Checkout</p>
          <Field label="Stripe Price ID">
            <Input value={tier.stripePriceId ?? ""} onChange={(v) => updateTier({ stripePriceId: v || undefined })} placeholder="price_..." />
          </Field>
          <Field label="Checkout Mode">
            <Select value={tier.stripeMode ?? "payment"} onChange={(v) => updateTier({ stripeMode: v as "payment" | "subscription" })}
              options={[{ value: "payment", label: "One-time payment" }, { value: "subscription", label: "Recurring subscription" }]}
            />
          </Field>
          <p className="text-[10px] text-[var(--muted-foreground)]">When set, the CTA button triggers Stripe checkout instead of a link.</p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={tier.highlight ?? false} onChange={(e) => updateTier({ highlight: e.target.checked })} className="accent-[var(--primary)]" />
          Highlight card (gold border + glow)
        </label>

        {tiers.length > 1 && (
          <button onClick={removeTier}
            className="w-full py-1.5 text-xs text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors"
          >
            Remove this tier
          </button>
        )}
      </div>
    </div>
  );
}

function SimpleSettings({ fields }: { fields: Array<{ label: string; value: string; onChange: (v: string) => void; type?: "text" | "textarea"; placeholder?: string; rows?: number }> }) {
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <Field key={f.label} label={f.label}>
          {f.type === "textarea"
            ? <Textarea value={f.value} onChange={f.onChange} placeholder={f.placeholder} rows={f.rows} />
            : <Input value={f.value} onChange={f.onChange} placeholder={f.placeholder} />
          }
        </Field>
      ))}
    </div>
  );
}

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram", "spotify", "youtube", "tiktok", "twitter",
  "facebook", "soundcloud", "apple_music", "bandcamp", "website",
];
const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram", spotify: "Spotify", youtube: "YouTube",
  tiktok: "TikTok", twitter: "Twitter", facebook: "Facebook",
  soundcloud: "SoundCloud", apple_music: "Apple Music", bandcamp: "Bandcamp", website: "Website",
};

function CornerNavSettings({ data, update }: { data: CornerNavBlockData; update: (d: Partial<CornerNavBlockData>) => void }) {
  const socialLinks = data.socialLinks ?? [];
  const bgType = data.backgroundType ?? "color";
  const siteContext = useBuilderStore((s) => s.siteContext);
  const [manualKeys, setManualKeys] = useState<Set<string>>(new Set());

  function addSocialLink() {
    const used = new Set(socialLinks.map((l) => l.platform));
    const next = SOCIAL_PLATFORMS.find((p) => !used.has(p)) ?? "instagram";
    update({ socialLinks: [...socialLinks, { id: crypto.randomUUID(), platform: next, url: "" }] });
  }

  function updateSocialLink(i: number, patch: Partial<{ platform: SocialPlatform; url: string }>) {
    update({ socialLinks: socialLinks.map((l, j) => j === i ? { ...l, ...patch } : l) });
  }

  return (
    <div className="space-y-4">
      <Field label="Artist Name">
        <Input value={data.artistName ?? ""} onChange={(v) => update({ artistName: v })} placeholder="Artist Name" />
      </Field>

      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">Background</label>
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
          {(["color", "image", "video"] as const).map((t) => (
            <button key={t} type="button" onClick={() => update({ backgroundType: t })}
              className={cn("flex-1 py-1.5 capitalize transition-colors",
                bgType === t ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >{t}</button>
          ))}
        </div>

        {bgType === "color" && (
          <div className="flex items-center gap-2">
            <input type="color" value={data.backgroundColor ?? "#0E0C09"}
              onChange={(e) => update({ backgroundColor: e.target.value })}
              className="h-8 w-10 rounded border border-[var(--border)] bg-transparent cursor-pointer flex-shrink-0"
            />
            <Input value={data.backgroundColor ?? "#0E0C09"} onChange={(v) => update({ backgroundColor: v })} placeholder="#0E0C09" />
          </div>
        )}
        {bgType === "image" && (
          <div className="space-y-2">
            <ImageUploader bucket="offering-media" folder="hero-images"
              value={data.backgroundImage ?? null}
              onChange={(url) => update({ backgroundImage: url ?? undefined })}
              aspectRatio="video"
            />
            {data.backgroundImage && (
              <FocusPointPicker imageUrl={data.backgroundImage}
                focusX={data.backgroundFocusX ?? 50} focusY={data.backgroundFocusY ?? 50}
                onChange={(x, y) => update({ backgroundFocusX: x, backgroundFocusY: y })}
                aspectRatio="video"
              />
            )}
          </div>
        )}
        {bgType === "video" && (
          <VideoUploader value={data.backgroundVideo ?? null} onChange={(url) => update({ backgroundVideo: url ?? undefined })} />
        )}
      </div>

      {(bgType === "image" || bgType === "video") && (
        <Field label={`Overlay Opacity — ${data.overlayOpacity ?? 0}%`}>
          <input type="range" min={0} max={80} step={5} value={data.overlayOpacity ?? 0}
            onChange={(e) => update({ overlayOpacity: Number(e.target.value) })}
            className="w-full accent-[var(--primary)]"
          />
        </Field>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">Corner Links</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {([
            ["Top Left", "topLeftLabel", "topLeftUrl", "Tour"],
            ["Top Right", "topRightLabel", "topRightUrl", "Listen"],
            ["Bottom Left", "bottomLeftLabel", "bottomLeftUrl", "Shop"],
            ["Bottom Right", "bottomRightLabel", "bottomRightUrl", "Contact"],
          ] as const).map(([label, labelKey, urlKey, placeholder]) => (
            <div key={label} className="space-y-1">
              <span className="text-[10px] text-[var(--muted-foreground)]">{label}</span>
              <Input value={(data[labelKey] as string) ?? ""} onChange={(v) => update({ [labelKey]: v })} placeholder={placeholder} />
              {siteContext ? (() => {
                const currentUrl = (data[urlKey] as string) ?? "";
                const isPageUrl = siteContext.pages.some((p) =>
                  currentUrl === `/${p.slug}` ||
                  currentUrl === `/sites/${siteContext.siteSlug}/${p.slug}`
                );
                const normalizedUrl = currentUrl.replace(`/sites/${siteContext.siteSlug}`, "");
                const isManual = manualKeys.has(urlKey) || (!isPageUrl && currentUrl !== "");
                const selectVal = isManual ? "__custom__" : (currentUrl === "" ? "" : normalizedUrl);
                return (
                  <>
                    <select
                      value={selectVal}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setManualKeys((prev) => new Set([...prev, urlKey]));
                        } else {
                          setManualKeys((prev) => { const next = new Set(prev); next.delete(urlKey); return next; });
                          update({ [urlKey]: e.target.value });
                        }
                      }}
                      className="w-full px-2 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
                    >
                      <option value="">— no link —</option>
                      {siteContext.pages.map((p) => (
                        <option key={p.id} value={`/${p.slug}`}>{p.title}</option>
                      ))}
                      <option value="__custom__">Enter manually…</option>
                    </select>
                    {selectVal === "__custom__" && (
                      <Input value={currentUrl} onChange={(v) => update({ [urlKey]: v })} placeholder="https://…" />
                    )}
                  </>
                );
              })() : (
                <Input value={(data[urlKey] as string) ?? ""} onChange={(v) => update({ [urlKey]: v })} placeholder="URL" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">Link Style</p>
        <div className="flex items-center gap-2">
          <input type="color" value={data.linkColor ?? "#F5F0E8"}
            onChange={(e) => update({ linkColor: e.target.value })}
            className="h-8 w-10 rounded border border-[var(--border)] bg-transparent cursor-pointer flex-shrink-0"
          />
          <span className="text-xs text-[var(--muted-foreground)]">Link color</span>
        </div>
        <Field label={`Link size — ${data.linkSize ?? 11}px`}>
          <input type="range" min={8} max={20} step={1} value={data.linkSize ?? 11}
            onChange={(e) => update({ linkSize: Number(e.target.value) })}
            className="w-full accent-[var(--primary)]"
          />
        </Field>
        <div className="flex items-center gap-2">
          <input type="color" value={data.socialIconColor ?? "#F5F0E8"}
            onChange={(e) => update({ socialIconColor: e.target.value })}
            className="h-8 w-10 rounded border border-[var(--border)] bg-transparent cursor-pointer flex-shrink-0"
          />
          <span className="text-xs text-[var(--muted-foreground)]">Social icon color</span>
        </div>
        <Field label={`Social icon size — ${data.socialIconSize ?? 15}px`}>
          <input type="range" min={10} max={32} step={1} value={data.socialIconSize ?? 15}
            onChange={(e) => update({ socialIconSize: Number(e.target.value) })}
            className="w-full accent-[var(--primary)]"
          />
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">Social Links</p>
        {socialLinks.map((link, i) => (
          <div key={link.id} className="flex items-center gap-1.5">
            <select value={link.platform} onChange={(e) => updateSocialLink(i, { platform: e.target.value as SocialPlatform })}
              className="px-2 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] flex-shrink-0"
            >
              {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{SOCIAL_LABELS[p]}</option>)}
            </select>
            <input value={link.url} onChange={(e) => updateSocialLink(i, { url: e.target.value })}
              placeholder="URL"
              className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
            />
            <button onClick={() => update({ socialLinks: socialLinks.filter((_, j) => j !== i) })}
              className="text-[var(--muted-foreground)] hover:text-red-400 flex-shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {socialLinks.length < SOCIAL_PLATFORMS.length && (
          <button onClick={addSocialLink}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
          >
            <Plus size={12} /> Add Social Link
          </button>
        )}
      </div>
    </div>
  );
}

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "multiple_choice", label: "Multiple choice (auto-advance)" },
  { value: "select_multiple", label: "Select multiple" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "rating", label: "Rating (1–10)" },
];

function ApplicationFormSettings({ data, update }: { data: ApplicationFormBlockData; update: (d: Partial<ApplicationFormBlockData>) => void }) {
  const questions = data.questions ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function addQuestion() {
    const q: FormField = { id: crypto.randomUUID(), type: "short_text", label: "Your question here", required: false };
    const updated = [...questions, q];
    update({ questions: updated });
    setExpandedId(q.id);
  }

  function removeQuestion(id: string) {
    update({ questions: questions.filter((q) => q.id !== id) });
    if (expandedId === id) setExpandedId(null);
  }

  function updateQuestion(id: string, patch: Partial<FormField>) {
    update({ questions: questions.map((q) => q.id === id ? { ...q, ...patch } : q) });
  }

  function moveQuestion(i: number, dir: -1 | 1) {
    const next = [...questions];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update({ questions: next });
  }

  return (
    <div className="space-y-5">
      {/* Welcome screen */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Welcome Screen</p>
        <Field label="Title"><Input value={data.welcomeTitle ?? ""} onChange={(v) => update({ welcomeTitle: v })} placeholder="Apply to Join" /></Field>
        <Field label="Subtitle"><Input value={data.welcomeSubtitle ?? ""} onChange={(v) => update({ welcomeSubtitle: v })} placeholder="Takes about 3 minutes…" /></Field>
        <Field label="Button text"><Input value={data.welcomeButtonText ?? ""} onChange={(v) => update({ welcomeButtonText: v })} placeholder="Start Application" /></Field>
      </div>

      {/* Questions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Questions</p>
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-md border border-[var(--border)] overflow-hidden">
            {/* Question header row */}
            <div
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--muted)] cursor-pointer"
              onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
            >
              <span className="text-[10px] text-[var(--muted-foreground)] font-mono w-4 flex-shrink-0">{i + 1}</span>
              <span className="flex-1 text-xs truncate text-[var(--foreground)]">{q.label || "Untitled question"}</span>
              <button onClick={(e) => { e.stopPropagation(); moveQuestion(i, -1); }} disabled={i === 0} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-20 p-0.5">▲</button>
              <button onClick={(e) => { e.stopPropagation(); moveQuestion(i, 1); }} disabled={i === questions.length - 1} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-20 p-0.5">▼</button>
              <button onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }} className="text-[var(--muted-foreground)] hover:text-red-400 p-0.5"><Trash2 size={11} /></button>
            </div>

            {/* Expanded editor */}
            {expandedId === q.id && (
              <div className="p-3 space-y-2.5 border-t border-[var(--border)]">
                <Field label="Type">
                  <select value={q.type} onChange={(e) => updateQuestion(q.id, { type: e.target.value as FormFieldType })}
                    className="w-full px-2 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
                    {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Question"><Input value={q.label} onChange={(v) => updateQuestion(q.id, { label: v })} placeholder="Your question…" /></Field>
                <Field label="Description (optional)"><Input value={q.description ?? ""} onChange={(v) => updateQuestion(q.id, { description: v || undefined })} placeholder="Hint or context for the applicant" /></Field>
                {q.type !== "multiple_choice" && q.type !== "rating" && (
                  <Field label="Placeholder"><Input value={q.placeholder ?? ""} onChange={(v) => updateQuestion(q.id, { placeholder: v || undefined })} placeholder="Your answer…" /></Field>
                )}
                {q.type === "rating" && (
                  <Field label="Max rating">
                    <input type="number" min={2} max={10} value={q.maxRating ?? 5}
                      onChange={(e) => updateQuestion(q.id, { maxRating: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
                    />
                  </Field>
                )}
                {(q.type === "multiple_choice" || q.type === "select_multiple") && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--muted-foreground)]">Choices</label>
                    {(q.choices ?? []).map((choice, ci) => (
                      <div key={ci} className="flex items-center gap-1.5">
                        <Input value={choice} onChange={(v) => {
                          const next = [...(q.choices ?? [])];
                          next[ci] = v;
                          updateQuestion(q.id, { choices: next });
                        }} placeholder={`Option ${ci + 1}`} />
                        <button onClick={() => updateQuestion(q.id, { choices: (q.choices ?? []).filter((_, j) => j !== ci) })}
                          className="text-[var(--muted-foreground)] hover:text-red-400 flex-shrink-0"><Trash2 size={11} /></button>
                      </div>
                    ))}
                    <button onClick={() => updateQuestion(q.id, { choices: [...(q.choices ?? []), ""] })}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
                      <Plus size={11} /> Add choice
                    </button>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={q.required ?? false} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} className="accent-[var(--primary)]" />
                  <span className="text-xs text-[var(--foreground)]">Required</span>
                </label>
              </div>
            )}
          </div>
        ))}

        <button onClick={addQuestion}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
          <Plus size={12} /> Add question
        </button>
      </div>

      {/* Submit + Thank you */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Submission</p>
        <Field label="Submit button text"><Input value={data.submitButtonText ?? ""} onChange={(v) => update({ submitButtonText: v })} placeholder="Submit Application" /></Field>
        <Field label="Thank you title"><Input value={data.thankYouTitle ?? ""} onChange={(v) => update({ thankYouTitle: v })} placeholder="Application Received" /></Field>
        <Field label="Thank you message"><Input value={data.thankYouMessage ?? ""} onChange={(v) => update({ thankYouMessage: v })} placeholder="We'll be in touch soon…" /></Field>
        <Field label="Notification email"><Input value={data.notificationEmail ?? ""} onChange={(v) => update({ notificationEmail: v || undefined })} placeholder="you@example.com" type="email" /></Field>
      </div>
    </div>
  );
}

function SimpleFormSettings({ data, update }: { data: SimpleFormBlockData; update: (d: Partial<SimpleFormBlockData>) => void }) {
  const fields = data.fields ?? [];

  function updateField(i: number, patch: Partial<(typeof fields)[0]>) {
    const next = [...fields];
    next[i] = { ...next[i], ...patch };
    update({ fields: next });
  }

  return (
    <div className="space-y-4">
      <Field label="Heading">
        <Input value={data.heading ?? ""} onChange={(v) => update({ heading: v || undefined })} placeholder="Get in Touch" />
      </Field>
      <Field label="Subheading">
        <Input value={data.subheading ?? ""} onChange={(v) => update({ subheading: v || undefined })} placeholder="Optional" />
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">Fields</p>
        {fields.map((field, i) => (
          <div key={field.id} className="p-3 rounded-md border border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between">
              <Select value={field.type} onChange={(v) => updateField(i, { type: v as "text" | "email" | "phone" | "textarea" })}
                options={[
                  { value: "text", label: "Text" },
                  { value: "email", label: "Email" },
                  { value: "phone", label: "Phone" },
                  { value: "textarea", label: "Textarea" },
                ]}
              />
              <button onClick={() => update({ fields: fields.filter((_, j) => j !== i) })}
                className="text-[var(--muted-foreground)] hover:text-red-400 ml-2"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <Input value={field.label} onChange={(v) => updateField(i, { label: v })} placeholder="Label" />
            <Input value={field.placeholder ?? ""} onChange={(v) => updateField(i, { placeholder: v || undefined })} placeholder="Placeholder" />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={field.required ?? false} onChange={(e) => updateField(i, { required: e.target.checked })} className="accent-[var(--primary)]" />
                Required
              </label>
              {field.type !== "textarea" && (
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={field.halfWidth ?? false} onChange={(e) => updateField(i, { halfWidth: e.target.checked })} className="accent-[var(--primary)]" />
                  Half width
                </label>
              )}
            </div>
          </div>
        ))}
        <button
          onClick={() => update({ fields: [...fields, { id: crypto.randomUUID(), type: "text" as const, label: "New Field" }] })}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          <Plus size={12} /> Add Field
        </button>
      </div>

      <Field label="Submit Button Text">
        <Input value={data.submitText ?? ""} onChange={(v) => update({ submitText: v || undefined })} placeholder="Send Message" />
      </Field>
      <Field label="Success Message">
        <Input value={data.successMessage ?? ""} onChange={(v) => update({ successMessage: v || undefined })} placeholder="Thanks! I'll be in touch soon." />
      </Field>
      <Field label="Notification Email">
        <Input value={data.notificationEmail ?? ""} onChange={(v) => update({ notificationEmail: v || undefined })} placeholder="you@example.com" type="email" />
      </Field>
    </div>
  );
}

const MUSIC_PLATFORMS: MusicPlatform[] =["spotify", "apple_music", "soundcloud", "bandcamp", "youtube", "website"];
const MUSIC_LABELS: Record<MusicPlatform, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  soundcloud: "SoundCloud",
  bandcamp: "Bandcamp",
  youtube: "YouTube",
  website: "Website",
};

function MusicEmbedSettings({ data, update }: { data: MusicEmbedBlockData; update: (d: Partial<MusicEmbedBlockData>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="URL (Spotify, SoundCloud, or Apple Music)">
        <Input value={data.url} onChange={(v) => update({ url: v })} placeholder="https://open.spotify.com/..." />
      </Field>
      <Field label="Size">
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
          {(["compact", "full"] as const).map((s) => (
            <button key={s} type="button" onClick={() => update({ size: s })}
              className={cn("flex-1 py-1.5 capitalize transition-colors",
                (data.size ?? "full") === s ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >{s === "compact" ? "Compact" : "Full"}</button>
          ))}
        </div>
      </Field>
      <p className="text-[10px] text-[var(--muted-foreground)]">Compact mode shows a minimal bar (Spotify tracks only). Full shows the complete player.</p>
      <Field label="Caption">
        <Input value={data.caption ?? ""} onChange={(v) => update({ caption: v || undefined })} placeholder="Optional caption below the player" />
      </Field>
    </div>
  );
}

function AlbumShowcaseSettings({ data, update }: { data: AlbumShowcaseBlockData; update: (d: Partial<AlbumShowcaseBlockData>) => void }) {
  const tracklist = data.tracklist ?? [];
  const streamingLinks = data.streamingLinks ?? [];

  function updateTrack(i: number, patch: Partial<(typeof tracklist)[0]>) {
    const next = [...tracklist];
    next[i] = { ...next[i], ...patch };
    update({ tracklist: next });
  }

  function updateLink(i: number, patch: Partial<{ platform: MusicPlatform; url: string }>) {
    update({ streamingLinks: streamingLinks.map((l, j) => j === i ? { ...l, ...patch } : l) });
  }

  return (
    <div className="space-y-4">
      <Field label="Album Art">
        <ImageUploader
          bucket="offering-media"
          folder="album-art"
          value={data.albumArt ?? null}
          onChange={(url) => update({ albumArt: url ?? undefined })}
          aspectRatio="square"
        />
        {data.albumArt && (
          <FocusPointPicker
            imageUrl={data.albumArt}
            focusX={data.albumArtFocusX ?? 50}
            focusY={data.albumArtFocusY ?? 50}
            onChange={(x, y) => update({ albumArtFocusX: x, albumArtFocusY: y })}
            aspectRatio="square"
          />
        )}
      </Field>
      <Field label="Album Title">
        <Input value={data.albumTitle} onChange={(v) => update({ albumTitle: v })} placeholder="Album Title" />
      </Field>
      <Field label="Artist Name">
        <Input value={data.artistName ?? ""} onChange={(v) => update({ artistName: v || undefined })} placeholder="Optional" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Year">
          <Input value={data.releaseYear ?? ""} onChange={(v) => update({ releaseYear: v || undefined })} placeholder="2024" />
        </Field>
        <Field label="Type">
          <Select value={data.releaseType ?? "album"} onChange={(v) => update({ releaseType: v as AlbumShowcaseBlockData["releaseType"] })}
            options={[
              { value: "album", label: "Album" },
              { value: "ep", label: "EP" },
              { value: "single", label: "Single" },
              { value: "mixtape", label: "Mixtape" },
            ]}
          />
        </Field>
      </div>
      <Field label="Description">
        <Textarea value={data.description ?? ""} onChange={(v) => update({ description: v || undefined })} rows={3} placeholder="Optional description" />
      </Field>
      <Field label="Layout">
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
          {(["left", "center"] as const).map((l) => (
            <button key={l} type="button" onClick={() => update({ layout: l })}
              className={cn("flex-1 py-1.5 capitalize transition-colors",
                (data.layout ?? "left") === l ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >{l}</button>
          ))}
        </div>
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">Track Listing</p>
        {tracklist.map((track, i) => (
          <div key={track.id} className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--muted-foreground)] w-5 text-right flex-shrink-0">{i + 1}</span>
            <input
              value={track.title}
              onChange={(e) => updateTrack(i, { title: e.target.value })}
              placeholder="Track title"
              className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
            />
            <input
              value={track.duration ?? ""}
              onChange={(e) => updateTrack(i, { duration: e.target.value || undefined })}
              placeholder="3:24"
              className="w-14 flex-shrink-0 px-2 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
            />
            <button onClick={() => update({ tracklist: tracklist.filter((_, j) => j !== i) })}
              className="text-[var(--muted-foreground)] hover:text-red-400 flex-shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={() => update({ tracklist: [...tracklist, { id: crypto.randomUUID(), title: "Track Title" }] })}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          <Plus size={12} /> Add Track
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">Streaming Links</p>
        {streamingLinks.map((link, i) => (
          <div key={link.id} className="flex items-center gap-1.5">
            <select value={link.platform} onChange={(e) => updateLink(i, { platform: e.target.value as MusicPlatform })}
              className="px-2 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] flex-shrink-0"
            >
              {MUSIC_PLATFORMS.map((p) => <option key={p} value={p}>{MUSIC_LABELS[p]}</option>)}
            </select>
            <input value={link.url} onChange={(e) => updateLink(i, { url: e.target.value })}
              placeholder="URL"
              className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
            />
            <button onClick={() => update({ streamingLinks: streamingLinks.filter((_, j) => j !== i) })}
              className="text-[var(--muted-foreground)] hover:text-red-400 flex-shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {streamingLinks.length < MUSIC_PLATFORMS.length && (
          <button
            onClick={() => {
              const used = new Set(streamingLinks.map((l) => l.platform));
              const next = MUSIC_PLATFORMS.find((p) => !used.has(p)) ?? "spotify";
              update({ streamingLinks: [...streamingLinks, { id: crypto.randomUUID(), platform: next, url: "" }] });
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
          >
            <Plus size={12} /> Add Platform
          </button>
        )}
      </div>
    </div>
  );
}

function DiscographySettings({ data, update }: { data: DiscographyBlockData; update: (d: Partial<DiscographyBlockData>) => void }) {
  const releases = data.releases ?? [];

  function updateRelease(i: number, patch: Partial<(typeof releases)[0]>) {
    const next = [...releases];
    next[i] = { ...next[i], ...patch };
    update({ releases: next });
  }

  return (
    <div className="space-y-4">
      <Field label="Section Heading">
        <Input value={data.heading ?? ""} onChange={(v) => update({ heading: v || undefined })} placeholder="Discography" />
      </Field>
      <Field label="Subheading">
        <Input value={data.subheading ?? ""} onChange={(v) => update({ subheading: v || undefined })} placeholder="Optional" />
      </Field>
      <Field label="Columns">
        <Select value={String(data.columns ?? 3)} onChange={(v) => update({ columns: Number(v) as 2 | 3 | 4 })}
          options={[{ value: "2", label: "2 Columns" }, { value: "3", label: "3 Columns" }, { value: "4", label: "4 Columns" }]}
        />
      </Field>

      <div className="space-y-3">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">Releases</p>
        {releases.map((release, i) => (
          <div key={release.id} className="p-3 rounded-md border border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">Release {i + 1}</span>
              <button onClick={() => update({ releases: releases.filter((_, j) => j !== i) })}
                className="text-[var(--muted-foreground)] hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <Field label="Artwork">
              <ImageUploader
                bucket="offering-media"
                folder="discography"
                value={release.artwork ?? null}
                onChange={(url) => updateRelease(i, { artwork: url ?? undefined })}
                aspectRatio="square"
              />
            </Field>
            <Input value={release.title} onChange={(v) => updateRelease(i, { title: v })} placeholder="Title" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={release.year ?? ""} onChange={(v) => updateRelease(i, { year: v || undefined })} placeholder="Year" />
              <Select value={release.type ?? "album"} onChange={(v) => updateRelease(i, { type: v as "album" | "ep" | "single" | "mixtape" })}
                options={[
                  { value: "album", label: "Album" },
                  { value: "ep", label: "EP" },
                  { value: "single", label: "Single" },
                  { value: "mixtape", label: "Mixtape" },
                ]}
              />
            </div>
            <Input value={release.url ?? ""} onChange={(v) => updateRelease(i, { url: v || undefined })} placeholder="Link (optional)" />
          </div>
        ))}
        <button
          onClick={() => update({ releases: [...releases, { id: crypto.randomUUID(), title: "New Release", year: new Date().getFullYear().toString(), type: "album" as const }] })}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          <Plus size={12} /> Add Release
        </button>
      </div>
    </div>
  );
}

export function BlockSettings() {
  const selectedBlockId = useBuilderStore((s) => s.selectedBlockId);
  const blocks = useBuilderStore((s) => s.blocks);
  const updateBlockData = useBuilderStore((s) => s.updateBlockData);
  const selectBlock = useBuilderStore((s) => s.selectBlock);

  const block = blocks.find((b) => b.id === selectedBlockId);

  if (!block) {
    return (
      <div className="w-64 flex-shrink-0 border-l border-[var(--border)] bg-[var(--sidebar)] flex items-center justify-center p-6">
        <p className="text-sm text-[var(--muted-foreground)] text-center">
          Select a block to edit its settings
        </p>
      </div>
    );
  }

  const update = (data: Record<string, unknown>) => updateBlockData(block.id, data as never);

  return (
    <div className="w-72 flex-shrink-0 border-l border-[var(--border)] bg-[var(--sidebar)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <p className="text-sm font-semibold">{BLOCK_LABELS[block.type]}</p>
        <button onClick={() => selectBlock(null)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <X size={16} />
        </button>
      </div>
      <div key={block.id} className="flex-1 overflow-y-auto p-4">
        {block.type === "hero" && <HeroSettings data={block.data as HeroBlockData} update={update} />}
        {block.type === "text" && <TextSettings key={block.id} data={block.data as TextBlockData} update={update} />}
        {block.type === "feature_grid" && <FeatureGridSettings data={block.data as FeatureGridBlockData} update={update} />}
        {block.type === "testimonial" && <TestimonialSettings data={block.data as TestimonialBlockData} update={update} />}
        {block.type === "pricing_card" && <PricingSettings data={block.data as PricingCardBlockData} update={update} />}
        {block.type === "image" && (() => {
          const d = block.data as ImageBlockData;
          return (
            <div className="space-y-4">
              <Field label="Image">
                <ImageUploader
                  bucket="offering-media"
                  folder="image-block"
                  value={d.image ?? null}
                  onChange={(url) => update({ image: url ?? undefined })}
                  aspectRatio="wide"
                />
                {d.image && (
                  <FocusPointPicker
                    imageUrl={d.image}
                    focusX={d.imageFocusX ?? 50}
                    focusY={d.imageFocusY ?? 50}
                    onChange={(x, y) => update({ imageFocusX: x, imageFocusY: y })}
                    aspectRatio="wide"
                  />
                )}
              </Field>
              <Field label="Width">
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
                  {(["full", "wide", "medium", "small"] as const).map((w) => (
                    <button key={w} type="button" onClick={() => update({ width: w })}
                      className={cn("flex-1 py-1.5 capitalize transition-colors",
                        (d.width ?? "wide") === w
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      )}
                    >{w}</button>
                  ))}
                </div>
              </Field>
              {(d.width ?? "wide") !== "full" && (
                <Field label="Alignment">
                  <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a} type="button" onClick={() => update({ alignment: a })}
                        className={cn("flex-1 py-1.5 capitalize transition-colors",
                          (d.alignment ?? "center") === a
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        )}
                      >{a}</button>
                    ))}
                  </div>
                </Field>
              )}
              <Field label="Padding">
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
                  {(["none", "sm", "md", "lg"] as const).map((p) => (
                    <button key={p} type="button" onClick={() => update({ padding: p })}
                      className={cn("flex-1 py-1.5 capitalize transition-colors",
                        (d.padding ?? "md") === p
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      )}
                    >{p}</button>
                  ))}
                </div>
              </Field>
              <Field label="Caption"><Input value={d.caption ?? ""} onChange={(v) => update({ caption: v || undefined })} placeholder="Optional caption" /></Field>
            </div>
          );
        })()}
        {block.type === "image_text" && (() => {
          const d = block.data as ImageTextBlockData;
          return (
            <div className="space-y-4">
              <Field label="Image">
                <ImageUploader
                  bucket="offering-media"
                  folder="image-text"
                  value={d.image ?? null}
                  onChange={(url) => update({ image: url ?? undefined })}
                  aspectRatio="square"
                />
                {d.image && (
                  <FocusPointPicker
                    imageUrl={d.image}
                    focusX={d.imageFocusX ?? 50}
                    focusY={d.imageFocusY ?? 50}
                    onChange={(x, y) => update({ imageFocusX: x, imageFocusY: y })}
                    aspectRatio="square"
                  />
                )}
              </Field>
              <Field label="Image position">
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
                  {(["left", "right", "centered"] as const).map((pos) => (
                    <button key={pos} type="button" onClick={() => update({ imagePosition: pos })}
                      className={cn("flex-1 py-1.5 capitalize transition-colors",
                        (d.imagePosition ?? "left") === pos
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      )}
                    >{pos}</button>
                  ))}
                </div>
              </Field>
              <Field label="Heading"><Input value={d.heading ?? ""} onChange={(v) => update({ heading: v })} /></Field>
              <Field label="Subheading"><Input value={d.subheading ?? ""} onChange={(v) => update({ subheading: v || undefined })} placeholder="Optional" /></Field>
              <Field label="Body"><RichTextEditor content={d.body} onChange={(v) => update({ body: v })} /></Field>
              <Field label="CTA Text"><Input value={d.ctaText ?? ""} onChange={(v) => update({ ctaText: v })} /></Field>
              <Field label="CTA Link"><Input value={d.ctaLink ?? ""} onChange={(v) => update({ ctaLink: v })} placeholder="https://..." /></Field>
            </div>
          );
        })()}
        {block.type === "guarantee" && (() => {
          const d = block.data as GuaranteeBlockData;
          return (
            <div className="space-y-4">
              <Field label="Icon"><Input value={d.icon ?? ""} onChange={(v) => update({ icon: v })} placeholder="🛡️" /></Field>
              <Field label="Heading"><Input value={d.heading} onChange={(v) => update({ heading: v })} /></Field>
              <Field label="Body"><RichTextEditor content={d.body} onChange={(v) => update({ body: v })} /></Field>
            </div>
          );
        })()}
        {block.type === "cta_banner" && (
          <SimpleSettings fields={[
            { label: "Heading", value: (block.data as CTABannerBlockData).heading, onChange: (v) => update({ heading: v }) },
            { label: "Subheading", value: (block.data as CTABannerBlockData).subheading ?? "", onChange: (v) => update({ subheading: v }) },
            { label: "CTA Text", value: (block.data as CTABannerBlockData).ctaText, onChange: (v) => update({ ctaText: v }) },
            { label: "CTA Link", value: (block.data as CTABannerBlockData).ctaLink ?? "", onChange: (v) => update({ ctaLink: v }), placeholder: "https://..." },
          ]} />
        )}
        {block.type === "video_embed" && (
          <SimpleSettings fields={[
            { label: "Video URL (YouTube or Vimeo)", value: (block.data as VideoEmbedBlockData).url, onChange: (v) => update({ url: v }), placeholder: "https://youtube.com/watch?v=..." },
            { label: "Caption", value: (block.data as VideoEmbedBlockData).caption ?? "", onChange: (v) => update({ caption: v }), placeholder: "Optional caption" },
          ]} />
        )}
        {block.type === "spacer" && (
          <Field label="Height">
            <Select value={(block.data as SpacerBlockData).height} onChange={(v) => update({ height: v })}
              options={[{ value: "sm", label: "Small (32px)" }, { value: "md", label: "Medium (64px)" }, { value: "lg", label: "Large (96px)" }, { value: "xl", label: "Extra Large (128px)" }]}
            />
          </Field>
        )}
        {block.type === "divider" && (
          <div className="space-y-4">
            <Field label="Style">
              <Select value={(block.data as DividerBlockData).style} onChange={(v) => update({ style: v })}
                options={[{ value: "line", label: "Solid Line" }, { value: "dotted", label: "Dotted" }, { value: "gradient", label: "Gradient" }, { value: "ornament", label: "Ornament" }]}
              />
            </Field>
            <Field label="Width">
              <Select value={(block.data as DividerBlockData).width ?? "full"} onChange={(v) => update({ width: v })}
                options={[{ value: "full", label: "Full Width" }, { value: "centered", label: "Centered (50%)" }]}
              />
            </Field>
          </div>
        )}
        {block.type === "corner_nav" && <CornerNavSettings data={block.data as CornerNavBlockData} update={update} />}
        {block.type === "application_form" && <ApplicationFormSettings data={block.data as ApplicationFormBlockData} update={update} />}
        {block.type === "music_embed" && <MusicEmbedSettings data={block.data as MusicEmbedBlockData} update={update} />}
        {block.type === "album_showcase" && <AlbumShowcaseSettings data={block.data as AlbumShowcaseBlockData} update={update} />}
        {block.type === "discography" && <DiscographySettings data={block.data as DiscographyBlockData} update={update} />}
        {block.type === "simple_form" && <SimpleFormSettings data={block.data as SimpleFormBlockData} update={update} />}
      </div>
    </div>
  );
}
