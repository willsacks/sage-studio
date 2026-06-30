import { parseHTML } from "linkedom";

function parse(html: string) {
  const { document } = parseHTML(html);
  return document;
}

function serialize(document: Document): string {
  return "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
}

function sel(document: Document, selector: string): Element | null {
  try { return document.querySelector(selector); }
  catch { return null; }
}

/** Strip <script> and <noscript> tags from an HTML snippet — applied to all AI-authored HTML insertions. */
export function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
}

/** Build a lightweight DOM outline for context (tag+id+class+first-50-chars-text, 3 levels deep). */
export function buildPageSummary(html: string): string {
  const { document } = parseHTML(html);
  const lines: string[] = [];
  function walk(el: Element, depth: number) {
    if (depth > 3) return;
    const tag = el.tagName?.toLowerCase() ?? "?";
    if (["script", "style", "noscript", "meta", "link", "head"].includes(tag)) return;
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
    const text = (el.textContent ?? "").trim().slice(0, 50).replace(/\s+/g, " ");
    lines.push(`${"  ".repeat(depth)}<${tag}${id}${cls}> ${text ? `"${text}${text.length === 50 ? "…" : ""}"` : ""}`);
    Array.from(el.children ?? []).slice(0, 20).forEach((child) => walk(child, depth + 1));
  }
  const body = document.querySelector("body");
  if (body) Array.from(body.children ?? []).slice(0, 30).forEach((child) => walk(child, 0));
  return lines.join("\n");
}

export function setTextContent(html: string, selector: string, newText: string): string {
  const doc = parse(html);
  const el = sel(doc, selector);
  if (!el) return html;
  el.textContent = newText;
  return serialize(doc);
}

export function setAttribute(html: string, selector: string, attribute: string, value: string): string {
  const doc = parse(html);
  const el = sel(doc, selector);
  if (!el) return html;
  el.setAttribute(attribute, value);
  return serialize(doc);
}

export function setInlineStyle(html: string, selector: string, styleProperties: Record<string, string>): string {
  const doc = parse(html);
  const el = sel(doc, selector) as HTMLElement | null;
  if (!el) return html;
  const existing = el.getAttribute("style") ?? "";
  const styles: Record<string, string> = {};
  existing.split(";").forEach((s) => {
    const [k, v] = s.split(":").map((x) => x.trim());
    if (k && v) styles[k] = v;
  });
  Object.assign(styles, styleProperties);
  el.setAttribute("style", Object.entries(styles).map(([k, v]) => `${k}: ${v}`).join("; "));
  return serialize(doc);
}

export function insertHtml(
  html: string,
  snippet: string,
  position: "after_selector" | "before_selector" | "append_to_body" | "prepend_to_body",
  selector?: string,
): string {
  const safe = stripScripts(snippet);
  const doc = parse(html);
  const body = doc.querySelector("body");
  if (!body) return html;

  if (position === "append_to_body") { body.insertAdjacentHTML("beforeend", safe); return serialize(doc); }
  if (position === "prepend_to_body") { body.insertAdjacentHTML("afterbegin", safe); return serialize(doc); }
  if (!selector) return html;
  const target = sel(doc, selector);
  if (!target) return html;
  if (position === "after_selector") target.insertAdjacentHTML("afterend", safe);
  if (position === "before_selector") target.insertAdjacentHTML("beforebegin", safe);
  return serialize(doc);
}

export function replaceElement(html: string, selector: string, newHtml: string): string {
  const safe = stripScripts(newHtml);
  const doc = parse(html);
  const el = sel(doc, selector);
  if (!el) return html;
  el.outerHTML = safe;
  return serialize(doc);
}

export function removeElement(html: string, selector: string): string {
  const doc = parse(html);
  const el = sel(doc, selector);
  if (!el) return html;
  el.parentNode?.removeChild(el);
  return serialize(doc);
}

export function addLink(html: string, textToLink: string, href: string): string {
  const doc = parse(html);
  const body = doc.querySelector("body");
  if (!body) return html;
  const walker = doc.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */);
  let node;
  while ((node = walker.nextNode())) {
    const idx = (node.textContent ?? "").indexOf(textToLink);
    if (idx !== -1 && node.parentElement?.tagName?.toLowerCase() !== "a") {
      const text = node.textContent ?? "";
      const before = text.slice(0, idx);
      const after = text.slice(idx + textToLink.length);
      const anchor = doc.createElement("a");
      anchor.setAttribute("href", href);
      anchor.textContent = textToLink;
      const frag = doc.createDocumentFragment();
      if (before) frag.appendChild(doc.createTextNode(before));
      frag.appendChild(anchor);
      if (after) frag.appendChild(doc.createTextNode(after));
      node.parentNode?.replaceChild(frag, node);
      break;
    }
  }
  return serialize(doc);
}

export function getElementHtml(html: string, selector: string): string | null {
  const doc = parse(html);
  const el = sel(doc, selector);
  return el ? el.outerHTML : null;
}
