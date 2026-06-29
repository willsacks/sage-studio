"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

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
  toggleForm: (formId: string, connected: boolean) => void;
}

interface HtmlVisualEditorProps {
  html: string;
  onChange: (html: string) => void;
  onSelectionInfo?: (info: SelectionInfo | null) => void;
  onFormsDetected?: (forms: FormInfo[]) => void;
}

const EDIT_STYLE_ID = "__sage_edit_styles__";
const HANDLE_ATTR = "data-sage-handle";
const HANDLE_CLASS = "__sage_drag_handle__";
const SECTION_ATTR = "data-sage-section";
const DROP_INDICATOR_CLASS = "__sage_drop_indicator__";
const DRAGGING_CLASS = "__sage_dragging__";
const FORM_ID_ATTR = "data-sage-form-id";
const FORM_CONNECTED_ATTR = "data-sage-form";

// Leaf elements whose direct text content can be edited in place.
const EDITABLE_SELECTOR =
  "h1,h2,h3,h4,h5,h6,p,span,a,li,td,th,button,figcaption,label,blockquote,strong,em,small,div";

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
  function HtmlVisualEditor({ html, onChange, onSelectionInfo, onFormsDetected }, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const dragSrcRef = useRef<HTMLElement | null>(null);
  const lastRangeRef = useRef<Range | null>(null);

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
      [contenteditable="true"]:focus { outline: 2px solid #6366f1; outline-offset: 2px; background: rgba(99,102,241,0.05); }
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
      const hasDirectText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()
      );
      const hasElementChildren = el.children.length > 0;
      if (hasDirectText && !hasElementChildren) {
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
      if (anchorEl && sel?.getRangeAt(0).collapsed) {
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

  return (
    <iframe
      ref={iframeRef}
      className="flex-1 w-full border-none bg-white"
      sandbox="allow-same-origin"
      title="Edit page content"
    />
  );
});
