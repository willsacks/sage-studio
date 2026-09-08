/**
 * Seeds the Infinite Studio landing page into the willsage.com site.
 * Run: cd sage-studio && npx tsx scripts/seed-infinite-studio.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local manually (no dotenv dependency)
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function id() {
  return crypto.randomUUID();
}

const PAGE_DATA = [
  // ── HERO ────────────────────────────────────────────────────────────────────
  {
    id: "is-hero",
    type: "hero",
    data: {
      headline: "Bring AI Into Your Creative Practice.",
      subheadline:
        "With Depth. With Soul. Without Losing Yourself.",
      paragraph:
        "<p>The Infinite Studio is an 8-week immersive program for artists, musicians, writers, filmmakers, and multidisciplinary creators ready to weave artificial intelligence into their creative practice — with intention, discernment, and depth.</p><p></p><p>This is not a productivity hack. This is not a technical bootcamp. This is a creative apprenticeship for the age of AI.</p>",
      textAlign: "center",
      height: "lg",
      overlay: false,
      ctaText: "Join the Waitlist",
      ctaLink: "#apply",
    },
  },

  // ── DIVIDER ─────────────────────────────────────────────────────────────────
  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── THE MOMENT WE ARE IN ────────────────────────────────────────────────────
  {
    id: "is-moment",
    type: "text",
    data: {
      content: `<h2>The Moment We Are In</h2><p>We are living through a creative revolution.</p><p>The tools that once required entire teams, studios, budgets, and years of technical training are now accessible to a single person with a laptop and a vision.</p><p>This is extraordinary news for artists. And it's also terrifying.</p><p>Because alongside the tools comes the noise. The confusion. The flood of AI-generated content that threatens to drown authentic voice in a sea of synthetic sameness.</p><p>The question is not whether you will use AI. The question is <em>how</em>.</p><p>Will you use it as a crutch? Or as an instrument?<br>Will it replace your voice? Or amplify it?<br>Will it accelerate your drift? Or deepen your devotion to craft?</p><p>The Infinite Studio exists to help you answer these questions — and then to help you build the practice to live out your answers.</p>`,
      alignment: "center",
      maxWidth: true,
    },
  },

  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── TECHNOLOGY IN SERVICE OF SOUL ──────────────────────────────────────────
  {
    id: "is-soul",
    type: "text",
    data: {
      content: `<h2>Technology in Service of Soul</h2><p>The tools are not the point. The work is the point.</p><p>We believe AI is most powerful in the hands of artists who already have a strong sense of their aesthetic, their themes, and their creative soul. We believe the best AI-assisted work still begins with a human being who has cultivated their voice and knows what they're trying to say.</p><p>The Infinite Studio is built on a simple principle: technology should deepen your creative practice, not replace it. We move slowly enough to understand what we're doing and why. We move quickly enough to actually make things.</p>`,
      alignment: "left",
      maxWidth: true,
    },
  },

  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── THE 8-WEEK JOURNEY ──────────────────────────────────────────────────────
  {
    id: "is-curriculum",
    type: "feature_grid",
    data: {
      columns: 2,
      heading: "The 8-Week Journey",
      subheading:
        "Each week we go deep on one dimension of AI-assisted creative practice.",
      features: [
        {
          id: id(),
          icon: "◎",
          title: "Week 1: Your Creative Identity in the Age of AI",
          description:
            "Clarify who you are as a creator before the tools enter the room. Establish the foundation that no algorithm can give you.",
        },
        {
          id: id(),
          icon: "◎",
          title: "Week 2: Listening to the Machine (and Knowing When Not To)",
          description:
            "Learn to have a creative dialogue with AI — and develop the discernment to know when to follow it and when to trust yourself instead.",
        },
        {
          id: id(),
          icon: "◎",
          title: "Week 3: AI as Collaborator vs. AI as Tool",
          description:
            "Explore the critical difference between using AI as a co-creator versus a production assistant — and what each relationship means for your work.",
        },
        {
          id: id(),
          icon: "◎",
          title: "Week 4: Prompt as Craft",
          description:
            "Master the art of writing to get what you actually want. Prompting is a creative skill — we treat it like one.",
        },
        {
          id: id(),
          icon: "◎",
          title: "Week 5: Building Your AI-Augmented Workflow",
          description:
            "Design a personal creative workflow that integrates AI where it serves you and protects the space where you work alone.",
        },
        {
          id: id(),
          icon: "◎",
          title: "Week 6: Making the Work",
          description:
            "Your first AI-assisted project. Apply everything you've learned in a real creative piece that is entirely your own.",
        },
        {
          id: id(),
          icon: "◎",
          title: "Week 7: Voice Preservation — Staying Human Inside the Machine",
          description:
            "Develop practices that keep your artistic voice intact as AI becomes more present in your workflow.",
        },
        {
          id: id(),
          icon: "◎",
          title: "Week 8: Integration & What Comes Next",
          description:
            "Synthesize the experience, showcase your work, and build your personal roadmap for an AI-integrated creative practice.",
        },
      ],
    },
  },

  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── WHO THIS IS FOR ─────────────────────────────────────────────────────────
  {
    id: "is-who",
    type: "text",
    data: {
      content: `<h2>Who This Is For</h2><p>The Infinite Studio is for the musician who wants to explore AI-generated sound design and production tools without losing the feeling of playing by ear. For the writer curious about AI as an editing, research, and worldbuilding partner — but terrified of becoming dependent on it. For the filmmaker or visual artist who wants to understand how generative image and video tools fit (or don't) into their process.</p><p>It's for the creator who has tried using AI and felt vaguely disgusted, unsatisfied, or lost — and wants to understand why. For the multidisciplinary artist who senses that AI might unlock something new in their practice, but needs a thoughtful container to explore it. For the producer, designer, or creative director who wants to stay ahead of the wave without surfing it blindly.</p><p>And above all, it's for the creator who wants to approach the question of AI and creativity with wisdom, not just efficiency.</p>`,
      alignment: "left",
      maxWidth: true,
    },
  },

  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── THE PROBLEM ─────────────────────────────────────────────────────────────
  {
    id: "is-problem",
    type: "text",
    data: {
      content: `<h2>The Problem</h2><p>We are at a moment of profound technological disruption in creative fields. Most creators are approaching it one of two ways.</p><p>The first: enthusiastic adoption without discernment — using AI to produce more, faster, with less thought. The second: fearful rejection — refusing to engage with the tools at all, hoping the wave will pass.</p><p>Both approaches leave you behind.</p><p>What's needed is a third path: engaged, thoughtful, soulful integration.</p><p>That's what The Infinite Studio provides.</p>`,
      alignment: "center",
      maxWidth: true,
    },
  },

  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── THE FORMAT ──────────────────────────────────────────────────────────────
  {
    id: "is-format",
    type: "feature_grid",
    data: {
      columns: 2,
      heading: "The Format",
      features: [
        {
          id: id(),
          icon: "◎",
          title: "8 Weeks, Cohort-Based",
          description:
            "A small, curated group of serious creators working through the program together.",
        },
        {
          id: id(),
          icon: "◎",
          title: "Weekly 90-Minute Live Sessions",
          description:
            "Deep, structured sessions with Will — not lectures, but working conversations with your work at the center.",
        },
        {
          id: id(),
          icon: "◎",
          title: "Daily Creative Prompts & Micro-Practices",
          description:
            "Short daily touchpoints that build the habits and intuitions that outlast the program.",
        },
        {
          id: id(),
          icon: "◎",
          title: "Private Community & End-of-Program Showcase",
          description:
            "Share work in progress, get honest feedback, and close with a celebration of what you made.",
        },
      ],
    },
  },

  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── ABOUT WILL SAGE ─────────────────────────────────────────────────────────
  {
    id: "is-about",
    type: "image_text",
    data: {
      imagePosition: "right",
      image:
        "https://glosoaocatxveqwmnyjw.supabase.co/storage/v1/object/public/offering-media/image-text/e1f52837-aa09-4959-823b-0efbe481ae99.jpg",
      heading: "Facilitated by Will Sage",
      subheading: "Musician, Producer & Technologist",
      body: "<p>Will Sage is a Nashville-based musician, producer, and creator who has spent 20 years at the intersection of technology and creativity.</p><p>He founded Kindara, a health technology platform that reached hundreds of thousands of users. He built and ran a startup accelerator. He has released more than 10 albums of original music and has spent years studying how technology can serve — rather than undermine — human creativity.</p><p>The Infinite Studio emerges from years of practice, experimentation, and deep reflection on what it means to be an artist in an age of artificial intelligence.</p>",
      ctaText: "Learn More About Will",
      ctaLink: "https://willsage.com/about",
    },
  },

  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── PHILOSOPHY ──────────────────────────────────────────────────────────────
  {
    id: "is-philosophy",
    type: "text",
    data: {
      content: `<h2>Our Philosophy</h2><p>We believe the soul of creativity cannot be automated. That great creative work still requires a human being with something to say. That AI is most powerful when held by a clear and practiced creative mind.</p><p>We believe the future belongs to artists who integrate technology without losing themselves. That the only way to navigate the age of AI as a creator is with both courage and discernment.</p><p>The Infinite Studio is a container for that kind of artist.</p>`,
      alignment: "center",
      maxWidth: true,
    },
  },

  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── PRICING / APPLICATION ───────────────────────────────────────────────────
  {
    id: "is-pricing",
    type: "pricing_card",
    data: {
      sectionHeading: "Join the Infinite Studio",
      sectionSubheading:
        "The next cohort is forming now. Enrollment is limited to keep the group small and the work serious.",
      tiers: [
        {
          id: id(),
          heading: "The Infinite Studio",
          badge: "8-Week Program",
          price: "Apply Now",
          period: "enrollment opens soon",
          description:
            "<p>Fill out a quick application to start a conversation about joining the next cohort.</p>",
          features: [
            "8 weeks of live, cohort-based sessions",
            "Weekly 90-minute sessions with Will",
            "Daily creative prompts & micro-practices",
            "Private community for sharing work",
            "Guest artists and AI practitioners",
            "End-of-program showcase",
          ],
          ctaText: "Apply to Join the Waitlist",
          ctaLink: "#apply",
          highlight: true,
          buttonStyle: "solid",
        },
      ],
      footerText:
        "The Infinite Studio is a small, curated cohort. We review every application personally. If you're accepted, we'll be in touch with enrollment details.",
    },
  },

  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── GUARANTEE ───────────────────────────────────────────────────────────────
  {
    id: "is-guarantee",
    type: "guarantee",
    data: {
      icon: "◎",
      heading: "Commitment Guarantee",
      body: "<p>Show up for the first two weeks of the program — attend every session, engage with the daily practices, and share your work. If after two weeks you don't feel The Infinite Studio is the right container for you, we'll refund your investment in full.</p>",
    },
  },

  { id: id(), type: "divider", data: { style: "gradient", width: "centered" } },

  // ── CLOSING TEXT ─────────────────────────────────────────────────────────────
  {
    id: "is-closing",
    type: "text",
    data: {
      content: `<h2>The Work AI Cannot Do</h2><p>There is work that no artificial intelligence will ever be able to do for you.</p><p>The work of choosing what to say. Of deciding what matters. Of holding a vision through years of creative development. Of knowing when a piece is done — not because the model stopped generating, but because it finally tells the truth.</p><p>That work is still human. It will always be human. And it is the work that matters most.</p><p>The Infinite Studio exists to help you do that work better, and to use the new tools in service of it — rather than in place of it.</p><p>If you're a creator who feels the weight of this moment and wants to meet it with something other than fear or reckless enthusiasm, this program was built for you.</p>`,
      alignment: "center",
      maxWidth: true,
    },
  },

  // ── FINAL CTA ────────────────────────────────────────────────────────────────
  {
    id: "is-cta-final",
    type: "cta_banner",
    data: {
      heading: "The Work Doesn't Wait.",
      subheading:
        "The next cohort is forming. Join the waitlist and be the first to know when enrollment opens.",
      ctaText: "Join the Waitlist",
      ctaLink: "#apply",
      background: "gold",
    },
  },

  // ── APPLICATION FORM ─────────────────────────────────────────────────────────
  {
    id: "apply",
    type: "application_form",
    data: {
      welcomeTitle: "Join the Waitlist",
      welcomeSubtitle:
        "Tell us a little about yourself and your creative practice. Takes about 3 minutes.",
      welcomeButtonText: "Start Application",
      questions: [
        {
          id: id(),
          type: "short_text",
          label: "What's your name?",
          placeholder: "Your full name",
          required: true,
        },
        {
          id: id(),
          type: "email",
          label: "What's your email address?",
          placeholder: "name@example.com",
          required: true,
        },
        {
          id: id(),
          type: "long_text",
          label: "Tell us about your creative practice.",
          description: "What do you make? How long have you been doing it?",
          placeholder: "I've been...",
          required: true,
        },
        {
          id: id(),
          type: "multiple_choice",
          label: "How would you describe your relationship with AI right now?",
          required: true,
          choices: [
            "Curious but haven't used it much",
            "Using it regularly but feeling uncertain",
            "Resistant — worried about what it means for my work",
            "Excited and looking for deeper guidance",
          ],
        },
        {
          id: id(),
          type: "long_text",
          label: "What are you hoping to get from The Infinite Studio?",
          placeholder: "I'm hoping to...",
          required: true,
        },
      ],
      thankYouTitle: "Application Received",
      thankYouMessage:
        "Thank you for applying. We review applications personally and will be in touch soon with next steps.",
      submitButtonText: "Submit Application",
      notificationEmail: "will@willsage.com",
    },
  },
];

async function main() {
  console.log("Fetching willsage.com site...");
  const { data: sites, error: siteError } = await supabase
    .from("artist_sites")
    .select("id, slug, name, user_id")
    .eq("custom_domain", "willsage.com");

  if (siteError) throw siteError;
  if (!sites || sites.length === 0) throw new Error("No site found with custom_domain = willsage.com");

  const site = sites[0];
  console.log(`Found site: "${site.name}" (${site.id})`);

  // Check if page already exists
  const { data: existing } = await supabase
    .from("site_pages")
    .select("id, slug")
    .eq("site_id", site.id)
    .eq("slug", "the-infinite-studio")
    .maybeSingle();

  if (existing) {
    console.log(`Page already exists at slug "the-infinite-studio" (${existing.id}). Skipping.`);
    console.log("To re-seed, delete the page first or update it manually.");
    return;
  }

  console.log("Inserting Infinite Studio page...");
  const { data: page, error: insertError } = await supabase
    .from("site_pages")
    .insert({
      site_id: site.id,
      user_id: site.user_id,
      slug: "the-infinite-studio",
      title: "The Infinite Studio",
      page_type: "custom",
      status: "draft",
      page_data: PAGE_DATA,
    })
    .select("id, slug, title, status")
    .single();

  if (insertError) throw insertError;

  console.log("\n✓ Page created:");
  console.log(`  ID:     ${page.id}`);
  console.log(`  Slug:   ${page.slug}`);
  console.log(`  Title:  ${page.title}`);
  console.log(`  Status: ${page.status}`);
  console.log(`\nEdit it at: https://sagestudio.org/my-site/${site.id}/pages/${page.id}`);
  console.log(`Preview at: https://willsage.com/the-infinite-studio (after DNS migration + publish)`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
