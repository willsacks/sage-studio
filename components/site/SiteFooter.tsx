import type { StyleTokens } from "@/lib/styles";

function isBlank(html: string | null | undefined): boolean {
  if (!html) return true;
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

/** Renders the site-wide Footer Text (set on Site Settings) at the bottom of
 * every block-built page. Renders nothing if left blank. HTML-imported pages
 * aren't wrapped in this — they render their own raw HTML (including their
 * own footer, if any) in a full-viewport iframe. */
export function SiteFooter({ footerText, tokens }: { footerText: string | null | undefined; tokens: StyleTokens }) {
  if (isBlank(footerText)) return null;
  return (
    <footer className="border-t" style={{ borderColor: `${tokens.colorText}15` }}>
      <style>{`.site-footer-text a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }`}</style>
      <div
        className="site-footer-text max-w-5xl mx-auto px-6 py-6 text-sm text-center"
        style={{ color: `${tokens.colorText}99` }}
        dangerouslySetInnerHTML={{ __html: footerText! }}
      />
    </footer>
  );
}
