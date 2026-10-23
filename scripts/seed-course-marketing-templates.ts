/**
 * Adds a focused set of course-marketing page templates to
 * `offer_templates`, alongside the library that already exists there
 * (shared with creatorscircle.art — e.g. "Book Launch", "Online
 * Course", "Platform Default"). That existing "Online Course" template
 * covers the generic case; these four give a creator several distinct
 * styles to choose from specifically, each built around the new
 * course_enroll block (Stripe Connect checkout) rather than the older
 * generic pricing_card.
 *
 * Schema note: this table's REAL columns are `name`/`template_key`/
 * `thumbnail_url`/`is_promoted` (confirmed via a live query) — NOT
 * `title`/`promoted` as lib/db.ts's hand-maintained stub previously
 * claimed; that stub has been corrected alongside this script.
 *
 * Every block here uses real field shapes from lib/types/builder.ts
 * (not re-imported, to keep this script runnable standalone with tsx —
 * just matched by hand against that file).
 *
 * Run: cd sage-studio && npx tsx scripts/seed-course-marketing-templates.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function block(type: string, data: Record<string, unknown>) {
  return { id: randomUUID(), type, data };
}

const BOLD_LAUNCH = {
  template_key: "course_bold_launch",
  name: "Course — Bold Launch",
  description: "High-energy hero, social proof, and a guarantee — built for a confident course launch.",
  theme: { accentColor: "#C9A84C", background: "dark", fontPairing: "bold" },
  page_data: [
    block("hero", {
      headline: "Turn What You Know Into A Course Students Finish",
      subheadline: "A step-by-step program that gets real results — not another video course that sits unwatched.",
      ctaText: "Enroll Now",
      height: "lg",
      textAlign: "center",
      overlay: true,
    }),
    block("feature_grid", {
      columns: 3,
      heading: "What You'll Walk Away With",
      features: [
        { id: randomUUID(), icon: "✦", title: "A Clear System", description: "Step-by-step modules that build on each other, not a random pile of videos." },
        { id: randomUUID(), icon: "✦", title: "Real Practice", description: "Exercises and assignments designed to get you doing the work, not just watching." },
        { id: randomUUID(), icon: "✦", title: "Lifetime Access", description: "Come back anytime — the material (and any updates) is yours for good." },
      ],
    }),
    block("testimonial", {
      heading: "Hear From Past Students",
      testimonials: [
        { id: randomUUID(), quote: "This is the course I wish I'd had years ago. Clear, practical, no fluff.", name: "Jordan P.", title: "Student" },
        { id: randomUUID(), quote: "I finally finished a course start to finish — and actually used what I learned.", name: "Casey M.", title: "Student" },
      ],
    }),
    block("guarantee", {
      heading: "30-Day Money-Back Guarantee",
      body: "Go through the course. If it's not for you, email within 30 days of enrolling for a full refund — no hoops to jump through.",
      icon: "🛡️",
    }),
    block("course_enroll", {
      description: "Enroll today and get instant access to every module.",
      buttonText: "Enroll Now",
    }),
    block("cta_banner", {
      heading: "Spots Are Limited",
      subheading: "Join now before enrollment closes.",
      ctaText: "Secure Your Seat",
      background: "gold",
    }),
  ],
};

const WARM_PERSONAL = {
  template_key: "course_warm_personal",
  name: "Course — Warm & Personal",
  description: "A story-first layout that leads with why you built this course, not just what's in it.",
  theme: { accentColor: "#B5804A", background: "light", fontPairing: "editorial" },
  page_data: [
    block("hero", {
      headline: "A Course Built From Everything I Learned The Hard Way",
      subheadline: "So you don't have to learn it the same way I did.",
      ctaText: "See What's Inside",
      height: "md",
      textAlign: "center",
      overlay: false,
    }),
    block("image_text", {
      imagePosition: "left",
      heading: "Why I Built This",
      body: "I spent years figuring this out through trial and error — the slow, expensive way. This course is everything I wish someone had handed me on day one: the real steps, in the right order, without the detours.",
      ctaText: "Read More Below",
    }),
    block("feature_grid", {
      columns: 2,
      heading: "Inside the Course",
      features: [
        { id: randomUUID(), icon: "✦", title: "Lesson-by-Lesson Guidance", description: "Short, focused lessons you can actually finish in one sitting." },
        { id: randomUUID(), icon: "✦", title: "Real Examples", description: "Not theory — the actual process, shown step by step." },
      ],
    }),
    block("testimonial", {
      heading: "What Students Are Saying",
      testimonials: [
        { id: randomUUID(), quote: "It felt like having a mentor walk me through it personally.", name: "Sam R.", title: "Student" },
        { id: randomUUID(), quote: "Warm, clear, and genuinely helpful — not salesy at all.", name: "Avery L.", title: "Student" },
      ],
    }),
    block("course_enroll", {
      description: "Ready to get started? Enrollment takes less than a minute.",
      buttonText: "Join The Course",
    }),
    block("guarantee", {
      heading: "Try It Risk-Free",
      body: "If it's not a fit within the first 30 days, just reach out for a full refund.",
      icon: "🤝",
    }),
  ],
};

const PREMIUM_MINIMAL = {
  template_key: "course_premium_minimal",
  name: "Course — Premium Minimal",
  description: "Quiet, confident, text-forward — for a course that sells on substance over hype.",
  theme: { accentColor: "#8A8A8A", background: "dark", fontPairing: "modern" },
  page_data: [
    block("hero", {
      headline: "A Focused Course For People Who Are Serious About This",
      subheadline: "No filler. No upsells. Just the material, organized well.",
      ctaText: "View Curriculum",
      height: "md",
      textAlign: "center",
      overlay: true,
    }),
    block("text", {
      content: "<p>This course is built for one kind of student: someone ready to put in the work. Every module exists because it has to, not to pad out the runtime.</p>",
      alignment: "center",
      size: "lg",
      maxWidth: true,
    }),
    block("feature_grid", {
      columns: 3,
      heading: "Curriculum At A Glance",
      features: [
        { id: randomUUID(), icon: "—", title: "Foundations", description: "The core concepts, explained clearly and completely." },
        { id: randomUUID(), icon: "—", title: "Application", description: "Guided practice that turns knowledge into skill." },
        { id: randomUUID(), icon: "—", title: "Mastery", description: "The details that separate good from great." },
      ],
    }),
    block("cta_banner", {
      heading: "Enrollment Is Open",
      subheading: "Start whenever you're ready — the material is always there.",
      ctaText: "Enroll",
      background: "dark",
    }),
    block("course_enroll", {
      description: "Full access, no subscriptions, yours to keep.",
      buttonText: "Enroll Now",
    }),
  ],
};

const SOCIAL_PROOF_HEAVY = {
  template_key: "course_social_proof",
  name: "Course — Social Proof Heavy",
  description: "Leads with real student results — ideal once you have a few testimonials to show off.",
  theme: { accentColor: "#C9A84C", background: "light", fontPairing: "bold" },
  page_data: [
    block("hero", {
      headline: "Join The Students Already Getting Results",
      subheadline: "A proven course, built on what's actually worked for the people who've taken it.",
      ctaText: "Enroll Now",
      height: "md",
      textAlign: "center",
      overlay: false,
    }),
    block("testimonial", {
      heading: "Real Students, Real Results",
      testimonials: [
        { id: randomUUID(), quote: "I saw a difference within the first two modules.", name: "Riley T.", title: "Student" },
        { id: randomUUID(), quote: "Worth every penny — I'd pay double for this.", name: "Morgan K.", title: "Student" },
        { id: randomUUID(), quote: "The most organized course I've ever taken.", name: "Dakota S.", title: "Student" },
      ],
    }),
    block("feature_grid", {
      columns: 3,
      heading: "What's Included",
      features: [
        { id: randomUUID(), icon: "✦", title: "Full Course Access", description: "Every module and lesson, available the moment you enroll." },
        { id: randomUUID(), icon: "✦", title: "Progress Tracking", description: "Pick up right where you left off, every time." },
        { id: randomUUID(), icon: "✦", title: "Lifetime Updates", description: "Any future improvements to the course are yours too." },
      ],
    }),
    block("guarantee", {
      heading: "30-Day Guarantee",
      body: "Not satisfied? Full refund within 30 days, no questions asked.",
      icon: "🛡️",
    }),
    block("course_enroll", {
      description: "Enroll today and join the students already seeing results.",
      buttonText: "Enroll Now",
    }),
    block("cta_banner", {
      heading: "Ready To Get Started?",
      ctaText: "Enroll Now",
      background: "gold",
    }),
  ],
};

const TEMPLATES = [BOLD_LAUNCH, WARM_PERSONAL, PREMIUM_MINIMAL, SOCIAL_PROOF_HEAVY];

async function main() {
  for (const t of TEMPLATES) {
    const { data: existing } = await supabase.from("offer_templates").select("id").eq("template_key", t.template_key).maybeSingle();
    if (existing) {
      console.log(`– "${t.name}" already exists, skipping`);
      continue;
    }
    const { error } = await supabase.from("offer_templates").insert({
      owner_id: null,
      owner_type: "platform",
      template_key: t.template_key,
      category: "platform",
      name: t.name,
      description: t.description,
      page_data: t.page_data,
      theme: t.theme,
    });
    if (error) {
      console.error(`✗ ${t.name}: ${error.message}`);
      process.exitCode = 1;
    } else {
      console.log(`✓ Seeded "${t.name}"`);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
