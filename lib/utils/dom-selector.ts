/**
 * Generates a CSS selector that uniquely identifies an element within its
 * document, and a short human-readable label — used by the AI-assistant
 * "click to select an element" picker (HtmlVisualEditor.tsx). Runs entirely
 * client-side against the real iframe DOM, unlike lib/utils/html-mutations.ts
 * which parses HTML server-side with linkedom.
 */

function escapeForSelector(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

function segmentFor(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${escapeForSelector(el.id)}`;
  const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean) : [];
  if (classes.length > 0) return `${tag}.${classes.slice(0, 3).map(escapeForSelector).join(".")}`;
  return tag;
}

function isUniqueSelector(selector: string, doc: Document): boolean {
  try {
    return doc.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

// HtmlVisualEditor.tsx injects a drag-handle <div data-sage-handle> as the
// first child of every top-level section for its reorder-by-drag UI. If left
// in place, every nth-child position computed here would be one off from
// what the same selector matches against the clean, stored HTML the server
// actually parses (no editor ever touched it there) — nth-child is a literal
// DOM-position pseudo-class with no way to tell it "skip these nodes," so the
// only correct fix is removing them from the live DOM before computing
// anything, then restoring them synchronously after. React never observes
// this iframe's DOM directly (it's fully rewritten via doc.write on html-prop
// changes, only ever read on-demand), so a same-tick remove/restore has no
// visible effect.
const INJECTED_SIBLING_SELECTOR = "[data-sage-handle]";

function withoutInjectedSiblings<T>(doc: Document, fn: () => T): T {
  const removed = Array.from(doc.querySelectorAll(INJECTED_SIBLING_SELECTOR)).map(
    (el) => [el, el.parentNode, el.nextSibling] as const
  );
  removed.forEach(([el]) => el.remove());
  try {
    return fn();
  } finally {
    for (const [el, parent, next] of removed) parent?.insertBefore(el, next);
  }
}

/** Re-query a selector produced by getUniqueSelector — must strip the same
 * injected siblings before matching, or a selector generated relative to the
 * clean (handle-free) structure won't find anything in the live, handle-
 * containing DOM even though it correctly identifies the element in the
 * actual stored HTML. Used by HtmlVisualEditor.tsx to keep the picked
 * highlight in sync with a persisted selection. */
export function queryIgnoringInjectedSiblings(selector: string, doc: Document): Element | null {
  return withoutInjectedSiblings(doc, () => {
    try {
      return doc.querySelector(selector);
    } catch {
      return null;
    }
  });
}

/** Imported HTML can be messy (duplicate ids, no classes, etc.), so this
 * always includes an nth-child fallback rather than trusting id/class alone —
 * "good enough and verified unique against the current document," not a
 * theoretically perfect selector. */
export function getUniqueSelector(el: Element, doc: Document): string {
  return withoutInjectedSiblings(doc, () => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== doc.documentElement) {
      let part = segmentFor(node);
      const parent: Element | null = node.parentElement;
      if (parent) {
        const index = Array.from(parent.children).indexOf(node) + 1;
        part += `:nth-child(${index})`;
      }
      parts.unshift(part);
      const candidate = parts.join(" > ");
      if (isUniqueSelector(candidate, doc)) return candidate;
      node = parent;
    }
    return parts.join(" > ");
  });
}

/** e.g. `<h2> "Sacred Sourcing"`, `<img> "Leslie in her studio"`, or a bare
 * `<div.hero-wrap>` for elements with no text/alt to identify them by. */
export function getElementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const fullText = (el.textContent ?? "").trim().replace(/\s+/g, " ");
  if (fullText) {
    const truncated = fullText.slice(0, 40);
    return `<${tag}> "${truncated}${fullText.length > 40 ? "…" : ""}"`;
  }
  if (tag === "img") {
    const alt = el.getAttribute("alt");
    if (alt) return `<img> "${alt.slice(0, 40)}"`;
  }
  const firstClass = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
  return firstClass ? `<${tag}.${firstClass}>` : `<${tag}>`;
}
