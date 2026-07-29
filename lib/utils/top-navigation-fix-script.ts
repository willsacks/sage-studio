/**
 * Builds a <script> tag that redirects normal link clicks on an imported
 * HTML page to the top-level window instead of the page's own <iframe
 * srcdoc>.
 *
 * These pages render inside a sandboxed iframe (see app/sites/[slug]/page.tsx
 * and app/sites/[slug]/[pageSlug]/page.tsx). A plain `<a href="/adorn">`
 * click has no target, so the browser navigates the *iframe itself* to that
 * URL — the iframe's base URL is inherited from the parent page (see
 * anchor-scroll-fix-script.ts), so the link resolves and loads correctly,
 * but only inside the nested iframe. The parent tab's own address bar and
 * history never change, so the visible page looks like it navigated while
 * the URL bar still shows the previous page. Links with target="_blank"
 * (every external entity-card link on these pages) are unaffected since
 * popups already escape the iframe via the `allow-popups` sandbox flag —
 * only same-window link clicks need this fix.
 */
function buildTopNavigationFixScript(): string {
  return `<script>(function(){
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#') return; // handled by the anchor-scroll fix
      var target = link.getAttribute('target');
      if (target === '_blank' || target === '_top') return; // already escapes the iframe correctly
      e.preventDefault();
      window.top.location.href = link.href;
    });
  })();</script>`;
}

/** Appends the top-navigation fix before </body>, or at the end if there's no closing body tag. */
export function injectTopNavigationFix(html: string): string {
  const script = buildTopNavigationFixScript();
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${script}</body>`) : `${html}${script}`;
}
