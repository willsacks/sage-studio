"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { getUniqueSelector, getElementLabel, queryIgnoringInjectedSiblings } from "@/lib/utils/dom-selector";

export interface SelectionInfo {
  hasSelection: boolean;
  href: string | null;
}

export interface FormInfo {
  id: string;
  label: string;
  connected: boolean;
}

export interface HtmlVisualEditorHandle {
  applyLink: (url: string) => void;
  removeLink: () => void;
  applyColor: (color: string) => void;
  clearColor: () => void;
  toggleForm: (formId: string, connected: boolean) => void;
}

interface HtmlVisualEditorProps {
  html: string;
  onChange: (html: string) => void;
  onSelectionInfo?: (info: SelectionInfo | null) => void;
  onFormsDetected?: (forms: FormInfo[]) => void;
  // AI-assistant element picker — see the "Element picker" section below.
  pickerMode?: boolean;
  selectedSelector?: string | null;
  onElementPicked?: (info: { selector: string; label: string } | null) => void;
}

const EDIT_STYLE_ID = "__sage_edit_styles__";
const HANDLE_ATTR = "data-sage-handle";
const HANDLE_CLASS = "__sage_drag_handle__";
const SECTION_ATTR = "data-sage-section";
const DROP_INDICATOR_CLASS = "__sage_drop_indicator__";
const DRAGGING_CLASS = "__sage_dragging__";
const FORM_ID_ATTR = "data-sage-form-id";
const FORM_CONNECTED_ATTR = "data-sage-form";
const PICKED_CLASS = "__sage_ai_picked__";

// Candidate elements whose text content can be edited in place. Whichever of
// these is the outermost "text-like" wrapper (see isTextLikeElement) becomes
// the actual contentEditable host — see the marking loop in setupEditing.
const EDITABLE_SELECTOR =
  "h1,h2,h3,h4,h5,h6,p,span,a,li,td,th,button,figcaption,label,blockquote,strong,em,small,div";

// Presentational inline-formatting tags. An element is "text-like" — safe to
// make the single contentEditable host for its whole subtree — if every
// element it contains (recursively) is one of these, e.g. <em>/<strong>/<br>
// inside a heading. Any other descendant tag (p, div, li, heading, ul,
// table, img...) marks it as a structural wrapper instead, so inner blocks
// stay independently editable rather than merging into one editable region.
const INLINE_FORMATTING_TAGS = new Set([
  "br", "em", "strong", "b", "i", "span", "small", "sub", "sup", "mark", "u", "a",
]);

function isTextLikeElement(el: Element): boolean {
  return Array.from(el.children).every(
    (child) => INLINE_FORMATTING_TAGS.has(child.tagName.toLowerCase()) && isTextLikeElement(child)
  );
}

function closestElement(node: Node | null): HTMLElement | null {
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
  return (node as HTMLElement | null) ?? null;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Renders HTML inside a sandboxed iframe and makes it directly editable:
 * text leaves become contentEditable, and top-level <body> children get a
 * drag handle so the user can reorder sections. Edits are serialized back
 * to a plain HTML string (with all editing affordances stripped) via onChange.
 * A link can be applied to the current text selection via the imperative
 * handle (applyLink/removeLink), driven by a control outside the iframe.
 */
export const HtmlVisualEditor = forwardRef<HtmlVisualEditorHandle, HtmlVisualEditorProps>(
  function HtmlVisualEditor({ html, onChange, onSelectionInfo, onFormsDetected, pickerMode = false, selectedSelector = null, onElementPicked }, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const dragSrcRef = useRef<HTMLElement | null>(null);
  const lastRangeRef = useRef<Range | null>(null);
  const pickerModeRef = useRef(pickerMode);
  const onElementPickedRef = useRef(onElementPicked);
  useEffect(() => { pickerModeRef.current = pickerMode; }, [pickerMode]);
  useEffect(() => { onElementPickedRef.current = onElementPicked; }, [onElementPicked]);

  const serialize = useCallback((): string | null => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.documentElement) return null;
    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(`#${EDIT_STYLE_ID}`).forEach((el) => el.remove());
    clone.querySelectorAll(`[${HANDLE_ATTR}]`).forEach((el) => el.remove());
    clone.querySelectorAll(`.${DROP_INDICATOR_CLASS}`).forEach((el) => el.remove());
    clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
    clone.querySelectorAll(`[${SECTION_ATTR}]`).forEach((el) => {
      el.removeAttribute(SECTION_ATTR);
      el.classList.remove(DRAGGING_CLASS);
    });
    clone.querySelectorAll(`[${FORM_ID_ATTR}]`).forEach((el) => el.removeAttribute(FORM_ID_ATTR));
    clone.querySelectorAll(`.${PICKED_CLASS}`).forEach((el) => el.classList.remove(PICKED_CLASS));
    clone.removeAttribute("data-picker-mode");
    return "<!DOCTYPE html>\n" + clone.outerHTML;
  }, []);

  const emitChange = useCallback(() => {
    const next = serialize();
    if (next === null) return;
    lastSyncedRef.current = next;
    onChange(next);
  }, [serialize, onChange]);

  const scanForms = useCallback((doc: Document) => {
    if (!onFormsDetected) return;
    const formEls = Array.from(doc.body?.querySelectorAll("form") ?? []);
    const forms: FormInfo[] = formEls.map((form, i) => {
      if (!form.hasAttribute(FORM_ID_ATTR)) form.setAttribute(FORM_ID_ATTR, String(i));
      const label =
        form.querySelector("h1,h2,h3,legend")?.textContent?.trim() ||
        form.getAttribute("name") ||
        form.getAttribute("id") ||
        `Form ${i + 1}`;
      return {
        id: form.getAttribute(FORM_ID_ATTR)!,
        label,
        connected: form.getAttribute(FORM_CONNECTED_ATTR) === "true",
      };
    });
    onFormsDetected(forms);
  }, [onFormsDetected]);

  const reportSelection = useCallback((doc: Document) => {
    if (!onSelectionInfo) return;
    const sel = doc.getSelection();
    if (!sel || sel.rangeCount === 0) {
      onSelectionInfo(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const el = closestElement(sel.anchorNode);
    const editableEl = el?.closest('[contenteditable="true"]') ?? null;
    if (!editableEl) {
      onSelectionInfo(null);
      return;
    }
    lastRangeRef.current = range.cloneRange();
    const linkEl = el?.closest("a") ?? null;
    onSelectionInfo({
      hasSelection: !range.collapsed || !!linkEl,
      href: linkEl?.getAttribute("href") ?? null,
    });
  }, [onSelectionInfo]);

  const setupEditing = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;

    let styleEl = doc.getElementById(EDIT_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = EDIT_STYLE_ID;
      doc.head?.appendChild(styleEl);
    }
    styleEl.textContent = `
      [contenteditable="true"] { outline: none; cursor: text; }
      [contenteditable="true"]:hover { outline: 1px dashed #6366f1; outline-offset: 2px; }
      /* No background here (only outline) — a background tint, even a faint
         one, wins specificity over the page's own single-class background
         rules (e.g. ".submit-btn { background: var(--ink) }"), silently
         replacing a dark button's real background while its light text stays
         light, making it unreadable while editing. Outline alone doesn't
         have this problem since it never competes with the element's own
         background/color. */
      [contenteditable="true"]:focus { outline: 2px solid #6366f1; outline-offset: 2px; }
      .${HANDLE_CLASS} {
        position: absolute; top: 6px; left: 6px; z-index: 999999;
        width: 24px; height: 24px; border-radius: 6px;
        background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center;
        font-size: 14px; line-height: 1; cursor: grab; opacity: 0; transition: opacity 0.15s; user-select: none;
        box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      }
      [${SECTION_ATTR}] { position: relative; }
      [${SECTION_ATTR}]:hover { outline: 1px dashed rgba(99,102,241,0.45); outline-offset: 4px; }
      [${SECTION_ATTR}]:hover > .${HANDLE_CLASS} { opacity: 1; }
      [${SECTION_ATTR}].${DRAGGING_CLASS} { opacity: 0.4; }
      .${DROP_INDICATOR_CLASS} { height: 3px; background: #6366f1; border-radius: 2px; margin: 2px 0; }
      /* AI-assistant element picker — solid green, distinct from the indigo
         dashed hover/edit outlines above so "picked for AI" never reads as
         just another hover state. */
      body[data-picker-mode="true"] * { cursor: crosshair !important; }
      body[data-picker-mode="true"] *:hover { outline: 1px dashed #16a34a !important; outline-offset: 1px; }
      .${PICKED_CLASS} { outline: 2px solid #16a34a !important; outline-offset: 2px; background: rgba(22,163,74,0.06) !important; }
      /* Scroll-reveal neutralizer: this iframe has no allow-scripts (see the
         sandbox comment below), so a page's own IntersectionObserver-driven
         "reveal on scroll" script never runs and .reveal content never gets
         its "visible" class added — it stays at opacity:0 forever, looking
         like it vanished even though the DOM is there. Scoped to this named
         convention (see scripts/add-adorn-copy-and-parallax.ts) rather than
         forcing every low-opacity element visible, since that would also
         force-reveal legitimately hover/click-gated UI elsewhere in the site
         (e.g. a mobile nav that's opacity:0 until scrolled/toggled). Extend
         the selector if another reveal-on-scroll convention shows up. */
      .reveal, .reveal.visible { opacity: 1 !important; transform: none !important; }
    `;

    const sections = Array.from(doc.body.children).filter(
      (el) => el.id !== EDIT_STYLE_ID && !el.hasAttribute(HANDLE_ATTR)
    ) as HTMLElement[];

    sections.forEach((section) => {
      section.setAttribute(SECTION_ATTR, "");
      if (section.querySelector(`.${HANDLE_CLASS}`)) return;

      const handle = doc.createElement("div");
      handle.className = HANDLE_CLASS;
      handle.setAttribute(HANDLE_ATTR, "");
      handle.setAttribute("draggable", "true");
      handle.setAttribute("contenteditable", "false");
      handle.title = "Drag to reorder this section";
      handle.textContent = "⠿"; // braille "all dots" glyph, reads as a grip icon
      section.insertBefore(handle, section.firstChild);

      handle.addEventListener("dragstart", (e) => {
        dragSrcRef.current = section;
        section.classList.add(DRAGGING_CLASS);
        e.dataTransfer?.setData("text/plain", "section");
      });
      handle.addEventListener("dragend", () => {
        section.classList.remove(DRAGGING_CLASS);
        doc.querySelectorAll(`.${DROP_INDICATOR_CLASS}`).forEach((n) => n.remove());
        dragSrcRef.current = null;
        emitChange();
      });
    });

    doc.body.ondragover = (e) => {
      if (!dragSrcRef.current) return;
      e.preventDefault();
      const siblings = sections.filter((el) => el !== dragSrcRef.current);
      doc.querySelectorAll(`.${DROP_INDICATOR_CLASS}`).forEach((n) => n.remove());
      const indicator = doc.createElement("div");
      indicator.className = DROP_INDICATOR_CLASS;
      const target = siblings.find((sib) => e.clientY < sib.getBoundingClientRect().top + sib.getBoundingClientRect().height / 2);
      if (target) {
        target.parentElement?.insertBefore(indicator, target);
      } else {
        doc.body.appendChild(indicator);
      }
    };

    doc.body.ondrop = (e) => {
      e.preventDefault();
      const src = dragSrcRef.current;
      const indicator = doc.querySelector(`.${DROP_INDICATOR_CLASS}`);
      if (src && indicator) {
        indicator.parentElement?.insertBefore(src, indicator);
      }
      doc.querySelectorAll(`.${DROP_INDICATOR_CLASS}`).forEach((n) => n.remove());
    };

    doc.body.querySelectorAll(EDITABLE_SELECTOR).forEach((el) => {
      if (el.hasAttribute(HANDLE_ATTR)) return; // drag handle glyph, never user text
      if (el.closest('[contenteditable="true"]')) return; // already inside a marked ancestor
      if (el.textContent?.trim() && isTextLikeElement(el)) {
        el.setAttribute("contenteditable", "true");
      }
    });

    let debounceTimer: ReturnType<typeof setTimeout>;
    doc.body.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(emitChange, 400);
    });

    doc.addEventListener("selectionchange", () => reportSelection(doc));
    doc.body.addEventListener("mouseup", () => reportSelection(doc));
    doc.body.addEventListener("keyup", () => reportSelection(doc));

    // Element picker for the AI assistant. Reads pickerModeRef (rather than a
    // closed-over prop) so toggling picker mode doesn't require re-running
    // this whole setup — mousedown is intercepted (not just click) because
    // contenteditable's native cursor placement happens on mousedown, before
    // a click handler alone could prevent it.
    doc.addEventListener("mousedown", (e) => {
      if (!pickerModeRef.current) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    doc.addEventListener("click", (e) => {
      if (!pickerModeRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const target = closestElement(e.target as Node);
      if (!target) return;
      onElementPickedRef.current?.({
        selector: getUniqueSelector(target, doc),
        label: getElementLabel(target),
      });
    }, true);

    scanForms(doc);
  }, [emitChange, reportSelection, scanForms]);

  useImperativeHandle(ref, () => ({
    applyLink(url: string) {
      const doc = iframeRef.current?.contentDocument;
      const win = iframeRef.current?.contentWindow;
      if (!doc || !win) return;
      const cleanUrl = normalizeUrl(url);

      win.focus();
      const sel = doc.getSelection();
      const range = lastRangeRef.current;
      if (sel && range) {
        sel.removeAllRanges();
        sel.addRange(range);
      }

      const anchorEl = closestElement(sel?.anchorNode ?? null)?.closest("a") ?? null;
      if (anchorEl) {
        anchorEl.setAttribute("href", cleanUrl);
      } else {
        doc.execCommand("createLink", false, cleanUrl);
      }
      emitChange();
      reportSelection(doc);
    },
    removeLink() {
      const doc = iframeRef.current?.contentDocument;
      const win = iframeRef.current?.contentWindow;
      if (!doc || !win) return;

      win.focus();
      const sel = doc.getSelection();
      const range = lastRangeRef.current;
      if (sel && range) {
        sel.removeAllRanges();
        sel.addRange(range);
      }

      const anchorEl = closestElement(sel?.anchorNode ?? null)?.closest("a") ?? null;
      if (anchorEl) {
        const parent = anchorEl.parentNode;
        while (anchorEl.firstChild) parent?.insertBefore(anchorEl.firstChild, anchorEl);
        parent?.removeChild(anchorEl);
      } else {
        doc.execCommand("unlink");
      }
      emitChange();
      reportSelection(doc);
    },
    applyColor(color: string) {
      const doc = iframeRef.current?.contentDocument;
      const win = iframeRef.current?.contentWindow;
      if (!doc || !win) return;

      win.focus();
      const sel = doc.getSelection();
      const range = lastRangeRef.current;
      if (sel && range) {
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // A collapsed selection (cursor just placed in a link, nothing dragged
      // over) has no text for execCommand to wrap — style the enclosing link
      // directly instead, same special-case applyLink already makes.
      const linkEl = range?.collapsed ? closestElement(sel?.anchorNode ?? null)?.closest("a") ?? null : null;
      if (linkEl) {
        linkEl.style.color = color;
      } else {
        // styleWithCSS makes execCommand write `<span style="color:...">`
        // instead of the legacy `<font color="...">` tag.
        doc.execCommand("styleWithCSS", false, "true");
        doc.execCommand("foreColor", false, color);
      }
      emitChange();
      reportSelection(doc);
    },
    clearColor() {
      const doc = iframeRef.current?.contentDocument;
      const win = iframeRef.current?.contentWindow;
      if (!doc || !win) return;

      win.focus();
      const sel = doc.getSelection();
      const range = lastRangeRef.current;
      if (sel && range) {
        sel.removeAllRanges();
        sel.addRange(range);
      }

      const linkEl = range?.collapsed ? closestElement(sel?.anchorNode ?? null)?.closest("a") ?? null : null;
      if (linkEl) {
        linkEl.style.removeProperty("color");
      } else {
        doc.execCommand("styleWithCSS", false, "true");
        doc.execCommand("foreColor", false, "inherit");
      }
      emitChange();
      reportSelection(doc);
    },
    toggleForm(formId: string, connected: boolean) {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const form = doc.querySelector(`[${FORM_ID_ATTR}="${formId}"]`);
      if (!form) return;
      if (connected) {
        form.setAttribute(FORM_CONNECTED_ATTR, "true");
      } else {
        form.removeAttribute(FORM_CONNECTED_ATTR);
      }
      emitChange();
      scanForms(doc);
    },
  }), [emitChange, reportSelection, scanForms]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (html === lastSyncedRef.current) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    lastSyncedRef.current = html;
    setupEditing();
  }, [html, setupEditing]);

  // Picker-mode hover/cursor styling — independent of the html-sync effect
  // above (which only fires on an actual html change) since toggling picker
  // mode alone shouldn't force a full doc rewrite. Also re-runs after an html
  // change, since doc.write() replaces <body> and drops the attribute.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    if (pickerMode) doc.body.setAttribute("data-picker-mode", "true");
    else doc.body.removeAttribute("data-picker-mode");
  }, [pickerMode, html]);

  // Keeps the picked-element highlight in sync with selectedSelector. Also
  // re-validates on every html change (an AI edit, a manual textarea edit, a
  // new file upload) — if the selector no longer matches anything, clears the
  // selection, since an element the edit just removed can't stay silently
  // "selected" in a sticky, multi-turn context.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    doc.querySelectorAll(`.${PICKED_CLASS}`).forEach((el) => el.classList.remove(PICKED_CLASS));
    if (!selectedSelector) return;
    const matched = queryIgnoringInjectedSiblings(selectedSelector, doc);
    if (matched) {
      matched.classList.add(PICKED_CLASS);
    } else {
      onElementPickedRef.current?.(null);
    }
  }, [selectedSelector, html]);

  return (
    <iframe
      ref={iframeRef}
      className="flex-1 w-full border-none bg-white"
      sandbox="allow-same-origin"
      title="Edit page content"
    />
  );
});
