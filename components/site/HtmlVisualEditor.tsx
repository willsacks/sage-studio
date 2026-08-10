"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { getUniqueSelector, getElementLabel, queryIgnoringInjectedSiblings } from "@/lib/utils/dom-selector";
import { buildGoogleFontsUrl } from "@/lib/styles/utils";
import { firstFontName } from "@/lib/utils/font-options";

export interface SelectionInfo {
  hasSelection: boolean;
  href: string | null;
  // Best-effort read of the focused text element's current font (first name
  // in its computed font-family stack) — lets the sidebar's Font picker show
  // what's actually applied right now instead of always starting blank.
  currentFont: string | null;
}

export interface FormInfo {
  id: string;
  label: string;
  connected: boolean;
}

export interface ImageSelectionInfo {
  selector: string;
  src: string;
  widthPx: number;
  // > 1 when this image is rendered at the exact same size as one or more
  // other images by the page's own CSS (an icon row, a photo grid, etc.) —
  // see findSizeSiblings. Lets the sidebar warn that resizing will move the
  // whole set together rather than distorting just this one instance.
  siblingCount: number;
}

export interface ElementSelectionInfo {
  selector: string;
  label: string;
}

export interface HtmlVisualEditorHandle {
  applyLink: (url: string) => void;
  removeLink: () => void;
  applyColor: (color: string) => void;
  clearColor: () => void;
  applyFont: (family: string, fallback: string) => void;
  clearFont: () => void;
  toggleForm: (formId: string, connected: boolean) => void;
  resizeSelectedImage: (width: number | "full") => void;
  replaceSelectedImageSrc: (url: string) => void;
  deleteSelectedElement: () => void;
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
  // Image selection/resize/replace — see the "Image editing" section below.
  selectedImageSelector?: string | null;
  onImageSelected?: (info: ImageSelectionInfo | null) => void;
  // Generic "select any non-text, non-image element to delete it" — see the
  // "Generic element selection" section below. Distinct from selectedSelector/
  // onElementPicked above (the AI-context picker) even though both are
  // "pick an element" mechanisms — this one drives the Delete button, that one
  // drives what gets sent to the AI assistant.
  selectedElementSelector?: string | null;
  onElementSelected?: (info: ElementSelectionInfo | null) => void;
  // Reported fresh on every click (not sticky like the selectors above) —
  // true whenever the click landed inside a <form>, so the sidebar's Forms
  // panel can show only when a form is actually the current context, not
  // just because the page happens to have one somewhere.
  onFormAreaSelected?: (active: boolean) => void;
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
const IMG_SELECTED_CLASS = "__sage_img_selected__";
const IMG_HANDLE_CLASS = "__sage_img_handle__";
const IMG_HANDLE_SIZE = 10;
const ELEMENT_SELECTED_CLASS = "__sage_el_selected__";
type ImageCorner = "tl" | "tr" | "bl" | "br";

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

const GOOGLE_FONTS_LINK_SELECTOR = 'link[href*="fonts.googleapis.com/css2"]';

// Reads which font families a page's *existing* Google Fonts <link> already
// declares, so applying a new font can extend that one link's family list
// instead of adding a redundant second <link> every time.
function collectLoadedGoogleFonts(doc: Document): string[] {
  const link = doc.head?.querySelector(GOOGLE_FONTS_LINK_SELECTOR) as HTMLLinkElement | null;
  if (!link) return [];
  try {
    const url = new URL(link.href);
    return url.searchParams
      .getAll("family")
      .map((f) => decodeURIComponent(f.split(":")[0]).replace(/\+/g, " "))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Ensures a Google Font is actually loadable in the iframe before it's
// applied — picking a font from the sidebar should always render correctly,
// not just set a font-family the browser silently falls back away from.
// Extends the page's existing combined Google Fonts <link> (the convention
// every page built by this editor already uses) rather than adding a new
// one, so a page never accumulates multiple redundant font <link> tags.
function ensureGoogleFontLoaded(doc: Document, family: string) {
  const loaded = collectLoadedGoogleFonts(doc);
  if (loaded.some((f) => f.toLowerCase() === family.toLowerCase())) return;
  const href = buildGoogleFontsUrl([...loaded, family]);
  const existing = doc.head?.querySelector(GOOGLE_FONTS_LINK_SELECTOR) as HTMLLinkElement | null;
  if (existing) {
    existing.setAttribute("href", href);
    return;
  }
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  doc.head?.appendChild(link);
}

// Image selection handles — positioned as document-flow-relative (not
// viewport-fixed) absolute elements so they scroll naturally with the page
// content without needing a scroll listener.
function positionImageHandles(img: HTMLImageElement, handles: Partial<Record<ImageCorner, HTMLElement>>, doc: Document) {
  const rect = img.getBoundingClientRect();
  const win = doc.defaultView;
  const scrollX = win?.scrollX ?? 0;
  const scrollY = win?.scrollY ?? 0;
  const left = rect.left + scrollX;
  const top = rect.top + scrollY;
  const half = IMG_HANDLE_SIZE / 2;
  const positions: Record<ImageCorner, [number, number]> = {
    tl: [left, top],
    tr: [left + rect.width, top],
    bl: [left, top + rect.height],
    br: [left + rect.width, top + rect.height],
  };
  (Object.keys(positions) as ImageCorner[]).forEach((corner) => {
    const handle = handles[corner];
    if (!handle) return;
    const [x, y] = positions[corner];
    handle.style.left = `${x - half}px`;
    handle.style.top = `${y - half}px`;
  });
}

const IMAGE_MIN_WIDTH = 40;

// Detects whether an image is one of a repeated/grid set (an icon row, a
// team-photo grid, a partner-logo strip...) rather than a standalone content
// image. Purely empirical — images the page's own CSS currently renders at
// the exact same size, with no inline override on any of them yet, are
// treated as one family — regardless of which selector or combination of
// rules is actually responsible. This sidesteps needing to parse or match
// the page's stylesheets at all, and is what lets resizing keep a design
// like a fixed-aspect-ratio circular-crop grid uniform instead of distorting
// just the one clicked image relative to its siblings.
function findSizeSiblings(img: HTMLImageElement, doc: Document): HTMLImageElement[] {
  if (img.style.width || img.style.height) return [];
  const rect = img.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w < 1 || h < 1) return [];
  const all = Array.from(doc.querySelectorAll("img")) as HTMLImageElement[];
  const group = all.filter((other) => {
    if (other !== img && (other.style.width || other.style.height)) return false;
    const r = other.getBoundingClientRect();
    return Math.round(r.width) === w && Math.round(r.height) === h;
  });
  return group.length > 1 ? group : [];
}

// Resizes a whole sibling group together by setting inline width/height
// directly on each element's live DOM reference — deliberately NOT a shared
// stylesheet rule matched by a generated selector. This editor injects a
// drag-reorder handle as the first child of every top-level body section
// (see setupEditing below), which shifts nth-child positions in the live,
// currently-being-edited DOM relative to the clean structure a selector gets
// generated against — harmless for the existing single-element selectors
// here (always re-queried through the same handle-stripped helper that
// generated them), but a real correctness bug for a selector meant to be
// matched as a literal CSS rule against the live DOM continuously while
// editing. Direct reference mutation sidesteps selector matching entirely,
// so it's correct regardless of handle position — the same reason the solo
// (non-grouped) resize path below never needed a selector either.
function applyGroupResize(elements: HTMLImageElement[], widthPx: number, heightPx: number) {
  elements.forEach((el) => {
    el.style.width = `${widthPx}px`;
    el.style.height = `${heightPx}px`;
    el.style.maxWidth = "100%";
    el.removeAttribute("width");
    el.removeAttribute("height");
  });
}

// Only corner handles (no edge handles) — resizing always scales
// proportionally rather than allowing distortion, which is what you almost
// always want for a photo. Horizontal mouse movement alone drives the
// resize; a left-side handle growing means dragging left, a right-side
// handle growing means dragging right — both read as "drag outward from the
// image to grow it," regardless of which corner you happen to grab.
//
// When the image is part of a detected sibling group (see
// findSizeSiblings), the drag resizes the whole group together, scaling
// height by the same ratio as width so a fixed crop box (e.g.
// object-fit:cover circles) keeps its shape — rather than the solo path's
// width:Npx;height:auto, which would stretch/crop it differently from its
// siblings.
function startImageDrag(
  corner: ImageCorner,
  startEvent: MouseEvent,
  img: HTMLImageElement,
  doc: Document,
  handles: Partial<Record<ImageCorner, HTMLElement>>,
  siblings: HTMLImageElement[],
  onCommit: () => void,
) {
  startEvent.preventDefault();
  startEvent.stopPropagation();
  const win = doc.defaultView;
  if (!win) return;
  const startX = startEvent.clientX;
  const startRect = img.getBoundingClientRect();
  const startWidth = startRect.width;
  const startHeight = startRect.height;
  const growsRight = corner === "tr" || corner === "br";
  const isGrouped = siblings.length > 1;

  function onMouseMove(e: MouseEvent) {
    const dx = e.clientX - startX;
    const delta = growsRight ? dx : -dx;
    const newWidth = Math.max(IMAGE_MIN_WIDTH, Math.round(startWidth + delta));
    if (isGrouped) {
      const newHeight = Math.max(IMAGE_MIN_WIDTH, Math.round(startHeight * (newWidth / startWidth)));
      applyGroupResize(siblings, newWidth, newHeight);
    } else {
      img.style.width = `${newWidth}px`;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
    }
    positionImageHandles(img, handles, doc);
  }
  function onMouseUp() {
    win!.removeEventListener("mousemove", onMouseMove);
    win!.removeEventListener("mouseup", onMouseUp);
    if (!isGrouped) {
      img.removeAttribute("width");
      img.removeAttribute("height");
    }
    onCommit();
  }
  win.addEventListener("mousemove", onMouseMove);
  win.addEventListener("mouseup", onMouseUp);
}

function showImageHandles(img: HTMLImageElement, doc: Document, onCommit: () => void) {
  img.classList.add(IMG_SELECTED_CLASS);
  const cursors: Record<ImageCorner, string> = { tl: "nwse-resize", br: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize" };
  const handles: Partial<Record<ImageCorner, HTMLElement>> = {};
  const siblings = findSizeSiblings(img, doc);
  (["tl", "tr", "bl", "br"] as ImageCorner[]).forEach((corner) => {
    const handle = doc.createElement("div");
    handle.className = IMG_HANDLE_CLASS;
    handle.setAttribute("contenteditable", "false");
    handle.style.cursor = cursors[corner];
    handle.addEventListener("mousedown", (e) => startImageDrag(corner, e, img, doc, handles, siblings, onCommit));
    doc.body.appendChild(handle);
    handles[corner] = handle;
  });
  positionImageHandles(img, handles, doc);
}

function clearImageHandles(doc: Document) {
  doc.querySelectorAll(`.${IMG_SELECTED_CLASS}`).forEach((el) => el.classList.remove(IMG_SELECTED_CLASS));
  doc.querySelectorAll(`.${IMG_HANDLE_CLASS}`).forEach((el) => el.remove());
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
  function HtmlVisualEditor({ html, onChange, onSelectionInfo, onFormsDetected, pickerMode = false, selectedSelector = null, onElementPicked, selectedImageSelector = null, onImageSelected, selectedElementSelector = null, onElementSelected, onFormAreaSelected }, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const dragSrcRef = useRef<HTMLElement | null>(null);
  const lastRangeRef = useRef<Range | null>(null);
  const pickerModeRef = useRef(pickerMode);
  const onElementPickedRef = useRef(onElementPicked);
  const onImageSelectedRef = useRef(onImageSelected);
  const onElementSelectedRef = useRef(onElementSelected);
  const onFormAreaSelectedRef = useRef(onFormAreaSelected);
  useEffect(() => { pickerModeRef.current = pickerMode; }, [pickerMode]);
  useEffect(() => { onElementPickedRef.current = onElementPicked; }, [onElementPicked]);
  useEffect(() => { onImageSelectedRef.current = onImageSelected; }, [onImageSelected]);
  useEffect(() => { onElementSelectedRef.current = onElementSelected; }, [onElementSelected]);
  useEffect(() => { onFormAreaSelectedRef.current = onFormAreaSelected; }, [onFormAreaSelected]);

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
    clone.querySelectorAll(`.${IMG_SELECTED_CLASS}`).forEach((el) => el.classList.remove(IMG_SELECTED_CLASS));
    clone.querySelectorAll(`.${IMG_HANDLE_CLASS}`).forEach((el) => el.remove());
    clone.querySelectorAll(`.${ELEMENT_SELECTED_CLASS}`).forEach((el) => el.classList.remove(ELEMENT_SELECTED_CLASS));
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
      currentFont: firstFontName(doc.defaultView?.getComputedStyle(editableEl).fontFamily),
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
      /* Image select/resize — blue, distinct from the indigo text-edit and
         green AI-picker outlines so all three selection states stay visually
         unambiguous at a glance. */
      img { cursor: pointer; }
      .${IMG_SELECTED_CLASS} { outline: 2px solid #2563eb; outline-offset: 2px; }
      .${IMG_HANDLE_CLASS} {
        position: absolute; width: ${IMG_HANDLE_SIZE}px; height: ${IMG_HANDLE_SIZE}px; z-index: 999999;
        background: #2563eb; border: 2px solid #fff; border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      /* Generic element select/delete — orange, distinct from the indigo
         text-edit, green AI-picker, and blue image-select outlines above,
         and deliberately NOT red (red is reserved for the actual destructive
         Delete button in the sidebar, so the outline itself doesn't read as
         "about to be deleted" before the user has clicked anything). */
      .${ELEMENT_SELECTED_CLASS} { outline: 2px solid #f97316; outline-offset: 2px; }
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

    // Every contentEditable host here is a single text leaf (p, h1-h6, span,
    // li...), never a container meant to hold multiple block children. But a
    // bare Enter key's default browser behavior tries to split the block —
    // and since e.g. a <p> can't legally nest another <p>, the browser
    // instead inserts sibling <div>s around the new line. Those <div>s are
    // invalid inside <p>, so re-parsing the saved HTML auto-closes the
    // paragraph early and strips the second half of the text out of its
    // styled wrapper (wrong font size, stray gap). Force Enter to insert a
    // <br> line break instead, keeping all the text inside one styled host.
    doc.body.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      const editableEl = closestElement(doc.getSelection()?.anchorNode ?? null)?.closest('[contenteditable="true"]');
      if (!editableEl) return;
      e.preventDefault();
      doc.execCommand("insertLineBreak");
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
      if (pickerModeRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const target = closestElement(e.target as Node);
        if (!target) return;
        onElementPickedRef.current?.({
          selector: getUniqueSelector(target, doc),
          label: getElementLabel(target),
        });
        return;
      }
      // Links are never "live" while editing — a real <a href> (a nav item,
      // a "Visit" button, anything with real text) would otherwise navigate
      // the iframe itself on click (sandboxed iframes still permit same-
      // frame navigation even without allow-scripts), landing on a 404 for
      // any relative/site-specific href and hijacking the click that was
      // meant to place a cursor or select the element instead. This runs
      // before any other click logic below so it applies regardless of
      // whether the link ends up being the contenteditable host itself, a
      // descendant of one, or neither.
      const linkAncestor = closestElement(e.target as Node)?.closest("a[href]");
      if (linkAncestor) e.preventDefault();

      // Image select/resize/replace, and generic element select/delete —
      // clicking any <img> selects it for resize/replace (unchanged);
      // clicking any other non-text, non-structural element inside a section
      // selects it for deletion (see "Generic element selection" below);
      // clicking real editable text, a section's own drag handle, or a bare
      // section background clears both.
      let target = closestElement(e.target as Node);
      // An empty <br>-only node (exactly the shape of the phantom-anchor
      // bug: an empty <a href="..."><br></a>) is never itself the
      // meaningful thing to select — its wrapper is.
      if (target?.tagName === "BR") target = target.parentElement;

      // Resolved and reported independently of the image/element-delete
      // branches below, so the sidebar's Forms panel shows whenever a form
      // is the current click context — including while editing text inside
      // one (e.g. a label), where both a text panel and the Forms panel are
      // simultaneously relevant.
      onFormAreaSelectedRef.current?.(!!target?.closest("form"));

      // The sidebar's Link/Text Color/Font panels are keyed off the browser's
      // own selection object (via reportSelection/onSelectionInfo, triggered
      // separately on mouseup) rather than this click handler — but that
      // object doesn't reliably clear itself here: clicking a non-text
      // element like an image can leave the DOM selection "snapped" to
      // nearby text instead of collapsing, which reportSelection would then
      // misread as still being in a text-editing context. Any branch below
      // that resolves to something other than real text editing clears it
      // explicitly rather than trusting that native behavior.
      if (target?.tagName === "IMG") {
        e.preventDefault();
        const img = target as HTMLImageElement;
        onImageSelectedRef.current?.({
          selector: getUniqueSelector(img, doc),
          src: img.getAttribute("src") ?? "",
          widthPx: Math.round(img.getBoundingClientRect().width),
          siblingCount: findSizeSiblings(img, doc).length,
        });
        onElementSelectedRef.current?.(null);
        onSelectionInfo?.(null);
        return;
      }
      onImageSelectedRef.current?.(null);

      const sectionAncestor = target?.closest(`[${SECTION_ATTR}]`) ?? null;
      const isSelectableForDeletion =
        !!target &&
        target !== doc.body &&
        !target.closest(`[${HANDLE_ATTR}]`) &&
        !target.closest('[contenteditable="true"]') &&
        !target.closest("form") && // forms get their own dedicated panel instead — see onFormAreaSelected above
        !!sectionAncestor &&
        target !== sectionAncestor;

      if (isSelectableForDeletion && target) {
        e.preventDefault(); // don't let a bare <a href> (e.g. the phantom link itself) navigate the iframe
        onSelectionInfo?.(null);
        onElementSelectedRef.current?.({
          selector: getUniqueSelector(target, doc),
          label: getElementLabel(target),
        });
      } else {
        onElementSelectedRef.current?.(null);
        // Only clear the text panels' state here if this genuinely isn't a
        // text click (a form's background, a section's own bare area,
        // doc.body) — a real click into contenteditable text still needs to
        // fall through to the native mouseup/selectionchange-driven
        // reportSelection() so hasSelection/href/currentFont stay accurate.
        if (!target?.closest('[contenteditable="true"]')) {
          onSelectionInfo?.(null);
        }
      }
    }, true);

    // Browsers let you drag any <img> by default (e.g. to drop it into
    // another app) — that native drag would fight with the custom resize-
    // handle dragging above, so it's suppressed entirely rather than trying
    // to out-race it with preventDefault timing on mousedown.
    doc.addEventListener("dragstart", (e) => {
      if (closestElement(e.target as Node)?.tagName === "IMG") e.preventDefault();
    }, true);

    scanForms(doc);
  }, [emitChange, reportSelection, scanForms, onSelectionInfo]);

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
      } else if (range && !range.collapsed) {
        doc.execCommand("createLink", false, cleanUrl);
      } else {
        // No enclosing <a> and nothing highlighted to wrap — execCommand
        // "createLink" on a collapsed selection is exactly what produced an
        // empty, invisible, permanently-stuck phantom <a>: WebKit inserts an
        // empty anchor at the cursor and bleeds the ambient
        // [contenteditable]:focus outline color onto it as an inline style.
        // There's nothing safe to link here — no-op rather than mutate the
        // DOM. HtmlPageEditor.tsx already hides this control whenever
        // selection.hasSelection is false, so this should be unreachable in
        // normal use; kept as a hard guard at the actual DOM-mutation
        // boundary regardless of caller.
        return;
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
      } else if (range && !range.collapsed) {
        // styleWithCSS makes execCommand write `<span style="color:...">`
        // instead of the legacy `<font color="...">` tag.
        doc.execCommand("styleWithCSS", false, "true");
        doc.execCommand("foreColor", false, color);
      } else {
        // Same guard as applyLink — a collapsed selection with no enclosing
        // link has nothing safe for execCommand to wrap, and produces the
        // same class of empty, style-bleeding phantom element.
        return;
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
      } else if (range && !range.collapsed) {
        doc.execCommand("styleWithCSS", false, "true");
        doc.execCommand("foreColor", false, "inherit");
      } else {
        return; // same guard as applyColor/applyLink — nothing safe to clear.
      }
      emitChange();
      reportSelection(doc);
    },
    // Font applies to the whole focused text element (the closest
    // contenteditable host), not a highlighted run within it — unlike color/
    // link, mixing two fonts inside one heading or paragraph is never really
    // what "change the font" means, and going straight to the DOM here
    // (rather than execCommand on a range) sidesteps the exact class of
    // empty-phantom-element bug execCommand produced for createLink/
    // foreColor on a collapsed selection.
    applyFont(family: string, fallback: string) {
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

      const el = closestElement(sel?.anchorNode ?? null)?.closest('[contenteditable="true"]') as HTMLElement | null;
      if (!el) return;
      ensureGoogleFontLoaded(doc, family);
      el.style.fontFamily = `'${family}', ${fallback}`;
      emitChange();
      reportSelection(doc);
    },
    clearFont() {
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

      const el = closestElement(sel?.anchorNode ?? null)?.closest('[contenteditable="true"]') as HTMLElement | null;
      if (!el) return;
      el.style.removeProperty("font-family");
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
    resizeSelectedImage(width: number | "full") {
      const doc = iframeRef.current?.contentDocument;
      if (!doc || !selectedImageSelector) return;
      const el = queryIgnoringInjectedSiblings(selectedImageSelector, doc);
      if (!el || el.tagName !== "IMG") return;
      const img = el as HTMLImageElement;
      const siblings = findSizeSiblings(img, doc);
      if (siblings.length > 1 && width !== "full") {
        const rect = img.getBoundingClientRect();
        const newWidth = Math.max(IMAGE_MIN_WIDTH, Math.round(width));
        const newHeight = Math.max(IMAGE_MIN_WIDTH, Math.round(rect.height * (newWidth / rect.width)));
        applyGroupResize(siblings, newWidth, newHeight);
        emitChange();
        return;
      }
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.width = width === "full" ? "100%" : `${Math.max(IMAGE_MIN_WIDTH, Math.round(width))}px`;
      img.removeAttribute("width");
      img.removeAttribute("height");
      emitChange();
    },
    replaceSelectedImageSrc(url: string) {
      const doc = iframeRef.current?.contentDocument;
      if (!doc || !selectedImageSelector) return;
      const el = queryIgnoringInjectedSiblings(selectedImageSelector, doc);
      if (!el || el.tagName !== "IMG") return;
      el.setAttribute("src", url);
      emitChange();
    },
    deleteSelectedElement() {
      const doc = iframeRef.current?.contentDocument;
      if (!doc || !selectedElementSelector) return;
      const el = queryIgnoringInjectedSiblings(selectedElementSelector, doc);
      if (!el) return;
      el.remove();
      emitChange();
    },
  }), [emitChange, reportSelection, scanForms, selectedImageSelector, selectedElementSelector]);

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

  // Same sticky, self-revalidating pattern as the AI-picker effect above, for
  // the selected-image handles. Also re-runs after emitChange() from a resize
  // or replace commits (those change `html`, which re-triggers the html-sync
  // effect first — same-commit effects run in declaration order — then this
  // one), which is what keeps the handles correctly positioned/re-created
  // against the freshly rewritten DOM after every edit — and, via the
  // unconditional report() below, keeps the sidebar's displayed width/preview
  // in sync no matter which path changed it (a canvas drag, the sidebar's own
  // width field, a preset button, or a replace), not just a canvas drag.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    clearImageHandles(doc);
    if (!selectedImageSelector) return;
    const matched = queryIgnoringInjectedSiblings(selectedImageSelector, doc);
    if (matched && matched.tagName === "IMG") {
      const img = matched as HTMLImageElement;
      const report = () => {
        onImageSelectedRef.current?.({
          selector: selectedImageSelector,
          src: img.getAttribute("src") ?? "",
          widthPx: Math.round(img.getBoundingClientRect().width),
          siblingCount: findSizeSiblings(img, doc).length,
        });
      };
      showImageHandles(img, doc, () => { emitChange(); report(); });
      report();
    } else {
      onImageSelectedRef.current?.(null);
    }
  }, [selectedImageSelector, html, emitChange]);

  // Keeps the generic element-selected highlight in sync with
  // selectedElementSelector — same sticky, self-revalidating pattern as the
  // AI-picker and image-select effects above. An AI edit, undo/redo, a raw-
  // HTML paste, or the delete action itself can all remove the selected
  // element from the DOM; when that happens the selector stops matching and
  // the selection clears automatically rather than staying silently
  // "selected" against nothing.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    doc.querySelectorAll(`.${ELEMENT_SELECTED_CLASS}`).forEach((el) => el.classList.remove(ELEMENT_SELECTED_CLASS));
    if (!selectedElementSelector) return;
    const matched = queryIgnoringInjectedSiblings(selectedElementSelector, doc);
    if (matched) {
      matched.classList.add(ELEMENT_SELECTED_CLASS);
    } else {
      onElementSelectedRef.current?.(null);
    }
  }, [selectedElementSelector, html]);

  return (
    <iframe
      ref={iframeRef}
      className="flex-1 w-full border-none bg-white"
      sandbox="allow-same-origin"
      title="Edit page content"
    />
  );
});
