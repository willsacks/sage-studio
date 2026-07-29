/**
 * Builds a <script> tag that intercepts same-page anchor clicks (href="#id")
 * on an imported HTML page.
 *
 * These pages render inside an <iframe srcdoc>, whose document URL is
 * `about:srcdoc` but whose *base* URL (used to resolve relative hrefs) is
 * inherited from the parent page. A native `<a href="#about">` click
 * therefore resolves to the parent's real URL + fragment, which never
 * matches `about:srcdoc` — so the browser treats it as a real cross-document
 * navigation instead of an in-page scroll, and the iframe tries to reload
 * the live page inside itself instead of scrolling. Handling the click in
 * JS and scrolling manually avoids that resolution path entirely.
 */
function buildAnchorScrollFixScript(): string {
  return `<script>(function(){
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      e.preventDefault();
      var id = link.getAttribute('href').slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Best-effort only — a srcdoc iframe's document URL is 'about:srcdoc',
      // so replaceState's same-origin check on the resolved '#id' URL always
      // throws here. It's harmless either way: this never affects the real
      // top-level address bar from inside the iframe.
      try { history.replaceState(null, '', '#' + id); } catch (err) {}
    });
  })();</script>`;
}

/** Appends the anchor-scroll fix before </body>, or at the end if there's no closing body tag. */
export function injectAnchorScrollFix(html: string): string {
  const script = buildAnchorScrollFixScript();
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${script}</body>`) : `${html}${script}`;
}
