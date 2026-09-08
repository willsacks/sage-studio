/**
 * Adds scroll parallax to the three big background photos on the Rooted
 * River home page (hero, the dark split section, footer), plus a gentle
 * fade-up scroll-reveal on the content blocks (balance icons, split text,
 * tributary thumbnails) for a bit of delight as you scroll.
 *
 * Each background photo is split out of its element's `background-image`
 * declaration into a dedicated absolutely-positioned `*-bg-layer` div with
 * extra top/bottom buffer, which a scroll listener translates within that
 * buffer — a classic layered parallax, done without disturbing the
 * carefully-tuned background-size/position crops already in place.
 *
 * Run: cd sage-studio && npx tsx scripts/add-rooted-river-home-parallax.ts
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

const PAGE_ID = "d48487da-7987-4746-b302-28a2ed31bf43"; // Rooted River home

const REVEAL_CSS = `
  /* ─── SCROLL REVEAL ──────────────────────────────────────────── */
  .reveal{ opacity:0; transform:translateY(26px); transition:opacity 0.8s ease, transform 0.8s ease;}
  .reveal.in-view{ opacity:1; transform:translateY(0);}
  .med-row .med.reveal:nth-child(1){ transition-delay:0ms;}
  .med-row .med.reveal:nth-child(2){ transition-delay:90ms;}
  .med-row .med.reveal:nth-child(3){ transition-delay:180ms;}
  .med-row .med.reveal:nth-child(4){ transition-delay:270ms;}
  .thumb-row .thumb.reveal:nth-child(1){ transition-delay:0ms;}
  .thumb-row .thumb.reveal:nth-child(2){ transition-delay:60ms;}
  .thumb-row .thumb.reveal:nth-child(3){ transition-delay:120ms;}
  .thumb-row .thumb.reveal:nth-child(4){ transition-delay:180ms;}
  .thumb-row .thumb.reveal:nth-child(5){ transition-delay:240ms;}
  .thumb-row .thumb.reveal:nth-child(6){ transition-delay:300ms;}
  .thumb-row .thumb.reveal:nth-child(7){ transition-delay:360ms;}
  .thumb-row .thumb.reveal:nth-child(8){ transition-delay:420ms;}
  @media (prefers-reduced-motion: reduce){
    .reveal{ opacity:1; transform:none; transition:none;}
  }
`;

const SCROLL_SCRIPT = `
<script>
  (function(){
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Background parallax ───────────────────────────────────────
    var heroBg = document.querySelector('.hero-bg-layer');
    var splitBg = document.querySelector('.split-bg-layer');
    var footerBg = document.querySelector('.footer-bg-layer');

    function clampShift(container, buffer, factor){
      var r = container.getBoundingClientRect();
      var containerCenter = r.top + r.height / 2;
      var viewportCenter = window.innerHeight / 2;
      var delta = (viewportCenter - containerCenter) * factor;
      return Math.max(-buffer, Math.min(buffer, delta));
    }

    if (!prefersReducedMotion && (heroBg || splitBg || footerBg)) {
      var ticking = false;
      function updateParallax(){
        if (heroBg) heroBg.style.transform = 'translateY(' + clampShift(heroBg.parentElement, 60, 0.18) + 'px)';
        if (splitBg) splitBg.style.transform = 'translateY(' + clampShift(splitBg.parentElement, 50, 0.16) + 'px)';
        if (footerBg) footerBg.style.transform = 'translateY(' + clampShift(footerBg.parentElement, 40, 0.14) + 'px)';
        ticking = false;
      }
      window.addEventListener('scroll', function(){
        if (!ticking) { window.requestAnimationFrame(updateParallax); ticking = true; }
      }, { passive: true });
      window.addEventListener('resize', updateParallax);
      updateParallax();
    }

    // ── Scroll reveal ───────────────────────────────────────────────
    var revealEls = document.querySelectorAll('.reveal');
    if (revealEls.length) {
      if (prefersReducedMotion || !('IntersectionObserver' in window)) {
        revealEls.forEach(function(el){ el.classList.add('in-view'); });
      } else {
        var io = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            if (entry.isIntersecting) {
              entry.target.classList.add('in-view');
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach(function(el){ io.observe(el); });
      }
    }
  })();
</script>
`;

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", PAGE_ID)
    .single();
  if (error) throw error;
  let html = page.html_content as string;

  // 1. Hero background → dedicated parallax layer
  const heroRe = /\.hero-photo\{ position:relative; height:78vh; min-height:560px; overflow:hidden;\s*\n\s*background-image: url\("([^"]+)"\);\s*\n\s*background-size:cover; background-position:center;\s*\n\s*\}/;
  const heroMatch = html.match(heroRe);
  if (heroMatch) {
    const replacement = `.hero-photo{ position:relative; height:78vh; min-height:560px; overflow:hidden;}
  .hero-bg-layer{ position:absolute; top:-60px; left:0; right:0; bottom:-60px; z-index:0;
    background-image: url("${heroMatch[1]}");
    background-size:cover; background-position:center;
    transform:translateY(0); will-change:transform;
  }`;
    html = html.replace(heroRe, replacement);
    console.log("✓ Hero background split into .hero-bg-layer.");
  } else if (html.includes("hero-bg-layer")) {
    console.log("• Hero parallax layer already present, skipped.");
  } else {
    throw new Error(".hero-photo background rule not found");
  }

  // 2. Split (dark) section background → dedicated parallax layer
  const splitRe = /\.split-photo\{ position:relative; overflow:hidden;\s*\n\s*background-image:url\("([^"]+)"\); background-size:169\.2% auto; background-position:97\.8% 30%; background-repeat:no-repeat;\}/;
  const splitMatch = html.match(splitRe);
  if (splitMatch) {
    const replacement = `.split-photo{ position:relative; overflow:hidden;}
  .split-bg-layer{ position:absolute; top:-50px; left:0; right:0; bottom:-50px; z-index:0;
    background-image:url("${splitMatch[1]}"); background-size:169.2% auto; background-position:97.8% 30%; background-repeat:no-repeat;
    transform:translateY(0); will-change:transform;}`;
    html = html.replace(splitRe, replacement);
    console.log("✓ Split background split into .split-bg-layer.");

    // Tablet override targeted the old .split-photo background rule — retarget it.
    const tabletOld = ".split-photo{ background-size:230% auto; background-position:88.5% 22%;}";
    const tabletNew = ".split-bg-layer{ background-size:230% auto; background-position:88.5% 22%;}";
    if (html.includes(tabletOld)) {
      html = html.replace(tabletOld, tabletNew);
      console.log("✓ Tablet split-photo override retargeted to .split-bg-layer.");
    }
  } else if (html.includes("split-bg-layer")) {
    console.log("• Split parallax layer already present, skipped.");
  } else {
    throw new Error(".split-photo background rule not found");
  }

  // 3. Footer background → dedicated parallax layer
  const footerRe = /footer\{ position:relative; background-color:var\(--forest\); color:var\(--ivory\); text-align:center; padding:80px 0 60px; margin-top:auto;\s*\n\s*background-image:url\("([^"]+)"\); background-size:cover; background-position:top center; background-repeat:no-repeat;\}/;
  const footerMatch = html.match(footerRe);
  if (footerMatch) {
    const replacement = `footer{ position:relative; background-color:var(--forest); color:var(--ivory); text-align:center; padding:80px 0 60px; margin-top:auto; overflow:hidden;}
  .footer-bg-layer{ position:absolute; top:-40px; left:0; right:0; bottom:-40px; z-index:-1;
    background-image:url("${footerMatch[1]}"); background-size:cover; background-position:top center; background-repeat:no-repeat;
    transform:translateY(0); will-change:transform;}`;
    html = html.replace(footerRe, replacement);
    console.log("✓ Footer background split into .footer-bg-layer.");
  } else if (html.includes("footer-bg-layer")) {
    console.log("• Footer parallax layer already present, skipped.");
  } else {
    throw new Error("footer background rule not found");
  }

  // 4. Reveal CSS, inserted right before </style>
  if (!html.includes("</style>")) throw new Error("</style> not found");
  if (!html.includes(".reveal{")) {
    html = html.replace("</style>", REVEAL_CSS + "</style>");
    console.log("✓ Reveal CSS added.");
  } else {
    console.log("• Reveal CSS already present, skipped.");
  }

  // 5. Insert bg-layer divs as first child of their containers
  if (html.includes('<div class="hero-photo">') && !html.includes('<div class="hero-bg-layer">')) {
    html = html.replace('<div class="hero-photo">', '<div class="hero-photo">\n    <div class="hero-bg-layer"></div>');
    console.log("✓ .hero-bg-layer div inserted.");
  }
  if (html.includes('<div class="split-photo">') && !html.includes('<div class="split-bg-layer">')) {
    html = html.replace('<div class="split-photo">', '<div class="split-photo">\n      <div class="split-bg-layer"></div>');
    console.log("✓ .split-bg-layer div inserted.");
  }
  if (html.includes("<footer>") && !html.includes('<div class="footer-bg-layer">')) {
    html = html.replace("<footer>", '<footer>\n  <div class="footer-bg-layer"></div>');
    console.log("✓ .footer-bg-layer div inserted.");
  }

  // 6. Reveal classes on content blocks
  const revealTargets: [string, string][] = [
    ['<h2>The <em>balance</em> between agency and surrender.</h2>', '<h2 class="reveal">The <em>balance</em> between agency and surrender.</h2>'],
    ['<p class="sub">Rooted River weaves together diverse tributaries', '<p class="sub reveal">Rooted River weaves together diverse tributaries'],
    ['<div class="split-text">', '<div class="split-text reveal">'],
    ['<div class="split-quote">', '<div class="split-quote reveal">'],
    ['<h2>Tributaries</h2>', '<h2 class="reveal">Tributaries</h2>'],
    ['<p class="sub">Many ways in. One river Home.', '<p class="sub reveal">Many ways in. One river Home.'],
  ];
  for (const [oldStr, newStr] of revealTargets) {
    if (html.includes(oldStr)) {
      html = html.replace(oldStr, newStr);
    } else if (!html.includes(newStr)) {
      throw new Error(`reveal target not found: ${oldStr.slice(0, 40)}...`);
    }
  }
  if (html.includes('<div class="med">')) {
    html = html.replaceAll('<div class="med">', '<div class="med reveal">');
    console.log("✓ .med reveal classes added.");
  }
  if (html.includes('<div class="thumb"><div class="thumb-photo"')) {
    html = html.replaceAll('<div class="thumb"><div class="thumb-photo"', '<div class="thumb reveal"><div class="thumb-photo"');
    console.log("✓ .thumb reveal classes added.");
  }

  // 7. Scroll script, inserted right before </body>
  if (!html.includes("</body>")) throw new Error("</body> not found");
  if (!html.includes("Background parallax")) {
    html = html.replace("</body>", SCROLL_SCRIPT + "</body>");
    console.log("✓ Parallax + reveal scroll script added.");
  } else {
    console.log("• Scroll script already present, skipped.");
  }

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;
  console.log("✓ Saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
