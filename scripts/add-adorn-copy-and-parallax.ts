/**
 * Adds Leslie's new copy to the Adorn page (Philosophy essays, a "Home as
 * Altar" manifesto band before Services, and a "Private Way of Working"
 * pricing/application block closing out Process), plus a scroll parallax
 * effect on the hero photo. All new headings follow the page's existing
 * typographic voice (title-case serif headings with one gold-italic accent
 * word, e.g. "Spaces that <em>hold you</em> differently") rather than
 * preserving Leslie's raw ALL-CAPS notes formatting, so everything reads as
 * part of the same design system instead of a pasted-in block.
 * Run: cd sage-studio && npx tsx scripts/add-adorn-copy-and-parallax.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PAGE_ID = "c69df5b7-61d1-4746-8c6e-47ceed90f4d7"; // Adorn page

const NEW_CSS = `
  /* ─── PHILOSOPHY ESSAYS (Sacred Sourcing / Psychometry) ────── */
  .philosophy-essays {
    margin-top: 5rem;
    padding-top: 5rem;
    border-top: 1px solid var(--gold-pale);
    display: flex;
    flex-direction: column;
    gap: 3.5rem;
  }
  .essay h3 {
    font-family: 'Cormorant Garant', serif;
    font-size: clamp(1.3rem, 2.2vw, 1.7rem);
    font-weight: 500;
    color: var(--ink);
    margin-bottom: 1.3rem;
  }
  .essay h3 em { font-style: italic; color: var(--gold); }
  .essay-text { max-width: 700px; margin-bottom: 1.1rem; }
  .essay-text:last-of-type { margin-bottom: 0; }
  .essay-closing {
    font-family: 'Cormorant Garant', serif;
    font-style: italic;
    font-size: 1.25rem;
    color: var(--ink);
    line-height: 1.6;
    max-width: 460px;
    margin-top: 1.6rem;
  }

  /* ─── THE HOME AS ALTAR ────────────────────────────────────── */
  .altar {
    background: var(--ink);
    padding: 7rem 3rem;
    text-align: center;
    border-top: 1px solid rgba(184,154,106,0.2);
  }
  .altar-inner { max-width: 700px; margin: 0 auto; }
  .altar-title {
    font-family: 'Cormorant Garant', serif;
    font-size: clamp(2rem, 4.2vw, 3.2rem);
    font-weight: 300;
    color: var(--cream);
    margin-bottom: 2rem;
  }
  .altar-title em { font-style: italic; color: var(--gold); }
  .altar-body {
    font-size: 0.95rem;
    font-weight: 300;
    color: rgba(250,247,242,0.65);
    line-height: 1.9;
    max-width: 560px;
    margin: 0 auto 1.4rem;
  }
  .altar-directives {
    font-family: 'Cormorant Garant', serif;
    font-style: italic;
    font-size: 1.25rem;
    color: var(--cream);
    line-height: 1.9;
    margin: 2.2rem 0;
  }
  .altar-closing {
    font-family: 'Cormorant Garant', serif;
    font-size: 1.5rem;
    font-weight: 300;
    color: var(--cream);
    line-height: 1.5;
    margin-top: 2.2rem;
  }
  .altar-closing em { font-style: italic; color: var(--gold); }

  /* ─── A PRIVATE WAY OF WORKING ─────────────────────────────── */
  .private-way {
    margin-top: 5rem;
    padding-top: 5rem;
    border-top: 1px solid rgba(184,154,106,0.15);
    max-width: 700px;
  }
  .private-way .section-title { font-size: clamp(1.8rem, 3.4vw, 2.6rem); }
  .process .private-way .body-text { color: rgba(250,247,242,0.55); margin-bottom: 1.3rem; max-width: 100%; }
  .private-fee {
    font-family: 'Cormorant Garant', serif;
    font-style: italic;
    font-size: 1.4rem;
    color: var(--gold);
    margin: 1.8rem 0;
  }
  .private-meta {
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(250,247,242,0.4);
    margin-top: 2.3rem;
    margin-bottom: 1.4rem;
  }
  .private-cta {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 400;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--ink);
    background: var(--gold);
    text-decoration: none;
    padding: 1rem 2.4rem;
    transition: background 0.3s;
  }
  .private-cta:hover { background: var(--cream); }
`;

const PHILOSOPHY_ESSAYS_HTML = `

      <div class="philosophy-essays">
        <div class="essay reveal">
          <h3>Sacred <em>Sourcing</em></h3>
          <p class="body-text essay-text">I believe objects carry energy. They hold the imprint of the hands that made them, the places they have lived and the lives they have witnessed. Sacred sourcing is the practice of choosing what enters our homes with reverence&mdash;not simply asking <em>Is it beautiful?</em> or even <em>Is it valuable?</em> but <em>What does it carry? What is its story? What does it awaken in me?</em></p>
          <p class="body-text essay-text">This becomes especially important when investing in significant pieces. Provenance, craftsmanship, rarity and condition matter&mdash;but so does understanding the deeper life of an object. Where has it been? Who made it? What culture, ritual or human story does it belong to? What are we actually inviting into our homes?</p>
          <p class="body-text essay-text">To me, this is where connoisseurship and intuition meet.</p>
        </div>
        <div class="essay reveal">
          <h3><em>Psychometry</em></h3>
          <p class="body-text essay-text">Psychometry is the idea that objects retain an energetic imprint of the people, places and experiences they have touched. I have always felt this intuitively. When I source an antique, I am not only choosing its form or evaluating its investment value. I am listening for its story.</p>
          <p class="body-text essay-text">Some objects feel alive. Some feel heavy. Some seem to have been waiting.</p>
          <p class="body-text essay-text">Understanding an object more deeply can completely change the way we value it. Its history can reveal greater significance&mdash;or ask us to think more carefully before bringing it home. Sacred sourcing is not about fear. It is about discernment. The more meaningful the investment, the more important it is to understand not only what we are buying, but what we are entering into relationship with.</p>
          <p class="essay-closing">The most powerful interiors are not filled with things.<br />They are assembled through relationship.</p>
        </div>
      </div>
`;

const ALTAR_HTML = `
<!-- THE HOME AS ALTAR -->
<div class="altar">
  <div class="altar-inner reveal">
    <h2 class="altar-title">The Home as <em>Altar</em></h2>
    <p class="altar-body">Your home is not simply where you keep your belongings. It is the physical altar of your life.</p>
    <p class="altar-body">What you place upon your walls, beside your bed and at the center of your table becomes part of your daily field of attention. These objects quietly speak to your nervous system, your imagination and your spirit.</p>
    <p class="altar-directives">Adorn your home as you would an altar.<br />Choose slowly. Choose with discernment.<br />Choose what has a story worthy of living beside.<br />Choose what reminds you of beauty, nature, ancestry, mystery, love and who you are becoming.</p>
    <p class="altar-closing">A sacred home does not need more.<br />It needs <em>meaning</em>.</p>
  </div>
</div>

`;

const PRIVATE_WAY_HTML = `

      <div class="private-way reveal">
        <h3 class="section-title">A Private Way of <em>Working</em></h3>
        <p class="body-text">This is a deeply personal and highly bespoke way of creating, offered to a limited number of clients each year.</p>
        <p class="private-fee">Our full-service engagements begin at $100,000 in professional fees.</p>
        <p class="body-text">Private sourcing journeys and sacred travel may be woven into the creative process, taking us from local artists&rsquo; studios and private workshops to the world&rsquo;s great design fairs, markets, ateliers, landscapes, and cultural traditions.</p>
        <p class="body-text">Each engagement is shaped around the client, the place, and the life being created.</p>
        <p class="body-text"><strong>Application is required.</strong> We believe the most extraordinary work begins with alignment. Our application process allows us to understand what you are creating, what is calling you, and whether we are the right people to make the journey with you.</p>
        <p class="private-meta">Limited engagements annually &middot; Application required</p>
        <a href="#connect" class="private-cta">Apply to Work With Us</a>
      </div>
`;

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", PAGE_ID)
    .single();
  if (error) throw error;
  let html = page.html_content as string;

  // 1. New CSS, inserted right before </style>
  if (!html.includes("</style>")) throw new Error("</style> not found");
  if (html.includes(".philosophy-essays {")) {
    console.log("• CSS already present, skipping CSS insert.");
  } else {
    html = html.replace("</style>", `${NEW_CSS}</style>`);
    console.log("✓ New CSS inserted.");
  }

  // 2. Mobile padding override for .altar, alongside the existing .statement one
  const mobileStatementRule = ".statement { padding: 4rem 1.5rem; }";
  if (!html.includes(mobileStatementRule)) throw new Error("mobile .statement rule not found");
  if (!html.includes(".altar { padding: 4rem 1.5rem; }")) {
    html = html.replace(mobileStatementRule, `${mobileStatementRule}\n    .altar { padding: 4rem 1.5rem; }`);
    console.log("✓ Mobile padding override added for .altar.");
  }

  // 3. Philosophy essays — insert inside .section-inner, before the section closes
  const pillarMarker = "I work only with pieces that will outlast trends and hold their beauty across decades. Investment at this level is personal, and I treat it that way.</p>\n          </div>\n        </div>\n      </div>\n    </div>\n  </div>\n</section>";
  if (!html.includes(pillarMarker)) throw new Error("Philosophy closing marker not found");
  if (!html.includes("<h3>Sacred <em>Sourcing</em></h3>")) {
    const pillarReplacement = "I work only with pieces that will outlast trends and hold their beauty across decades. Investment at this level is personal, and I treat it that way.</p>\n          </div>\n        </div>\n      </div>\n" + PHILOSOPHY_ESSAYS_HTML + "    </div>\n  </div>\n</section>";
    html = html.replace(pillarMarker, pillarReplacement);
    console.log("✓ Philosophy essays (Sacred Sourcing / Psychometry) added.");
  } else {
    console.log("• Philosophy essays already present, skipped.");
  }

  // 4. Home as Altar — insert between </section> (philosophy) and <!-- SERVICES -->
  if (!html.includes("<!-- SERVICES -->")) throw new Error("<!-- SERVICES --> marker not found");
  if (!html.includes('<div class="altar">')) {
    html = html.replace("<!-- SERVICES -->", `${ALTAR_HTML}<!-- SERVICES -->`);
    console.log("✓ 'The Home as Altar' section added before Services.");
  } else {
    console.log("• Altar section already present, skipped.");
  }

  // 5. Private Way of Working — insert inside .section-inner of .process, before the section closes
  const processMarker = "Placement is not logistics. I oversee the installation of every piece with care for how each element relates to the others, to the architecture, and to the people who will live within it.</p>\n        </div>\n      </div>\n    </div>\n  </div>\n</section>";
  if (!html.includes(processMarker)) throw new Error("Process closing marker not found");
  if (!html.includes("A Private Way of")) {
    const processReplacement = "Placement is not logistics. I oversee the installation of every piece with care for how each element relates to the others, to the architecture, and to the people who will live within it.</p>\n        </div>\n      </div>\n" + PRIVATE_WAY_HTML + "    </div>\n  </div>\n</section>";
    html = html.replace(processMarker, processReplacement);
    console.log("✓ 'A Private Way of Working' block added to Process.");
  } else {
    console.log("• Private Way of Working already present, skipped.");
  }

  // 6. Parallax: give .hero-bg scroll room and a base offset, then translate it on scroll
  const oldHeroBgOpen = `.hero-bg {
    position: absolute;
    inset: 0;`;
  const newHeroBgOpen = `.hero-bg {
    position: absolute;
    top: -80px;
    left: 0;
    right: 0;
    bottom: -80px;
    transform: translateY(80px);
    will-change: transform;`;
  if (html.includes(oldHeroBgOpen)) {
    html = html.replace(oldHeroBgOpen, newHeroBgOpen);
    console.log("✓ .hero-bg given scroll buffer for parallax.");
  } else if (html.includes(newHeroBgOpen)) {
    console.log("• .hero-bg parallax buffer already present, skipped.");
  } else {
    throw new Error(".hero-bg opening rule not found in either old or new form");
  }

  const oldScriptOpen = `<script>
  // ── Nav scroll effect ─────────────────────────────────────────
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });`;
  const newScriptOpen = `<script>
  // ── Nav scroll effect ─────────────────────────────────────────
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });

  // ── Hero parallax ─────────────────────────────────────────────
  const heroBg = document.querySelector('.hero-bg');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (heroBg && !prefersReducedMotion) {
    window.addEventListener('scroll', () => {
      const shift = 80 + Math.min(window.scrollY * 0.25, 60);
      heroBg.style.transform = 'translateY(' + shift + 'px)';
    }, { passive: true });
  }`;
  if (html.includes(oldScriptOpen)) {
    html = html.replace(oldScriptOpen, newScriptOpen);
    console.log("✓ Parallax scroll listener added.");
  } else if (html.includes("Hero parallax")) {
    console.log("• Parallax script already present, skipped.");
  } else {
    throw new Error("nav scroll script block not found");
  }

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;
  console.log("✓ Saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
