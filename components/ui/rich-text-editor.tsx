"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Link as LinkIcon, Minus, Code2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder = "Write your text here…" }: RichTextEditorProps) {
  const [showHtml, setShowHtml] = useState(false);
  const [htmlValue, setHtmlValue] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Placeholder.configure({ placeholder }),
    ],
    content: content || "<p></p>",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[140px] text-sm leading-relaxed prose-editor",
      },
    },
  });

  if (!editor) return null;

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Enter URL", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  function toggleHtml() {
    if (!editor) return;
    if (!showHtml) {
      setHtmlValue(editor.getHTML());
      setShowHtml(true);
    } else {
      editor.commands.setContent(htmlValue);
      onChange(htmlValue);
      setShowHtml(false);
    }
  }

  return (
    <div className="border border-[var(--border)] rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-[var(--primary)]">
      <style>{`
        .prose-editor p { margin-bottom: 0.5em; color: var(--foreground); }
        .prose-editor p:last-child { margin-bottom: 0; }
        .prose-editor h2 { font-size: 1.2em; font-weight: 700; margin: 0.75em 0 0.4em; color: var(--foreground); }
        .prose-editor h3 { font-size: 1.05em; font-weight: 600; margin: 0.75em 0 0.4em; color: var(--foreground); }
        .prose-editor ul, .prose-editor ol { padding-left: 1.4em; margin-bottom: 0.5em; color: var(--foreground); }
        .prose-editor li { margin-bottom: 0.25em; }
        .prose-editor blockquote { border-left: 3px solid var(--primary); padding-left: 0.75em; margin-left: 0; color: var(--muted-foreground); font-style: italic; }
        .prose-editor strong { font-weight: 600; }
        .prose-editor em { font-style: italic; }
        .prose-editor a { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
        .prose-editor hr { border: none; border-top: 1px solid var(--border); margin: 0.75em 0; }
        .prose-editor p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--muted-foreground); pointer-events: none; float: left; height: 0; }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--muted)]">
        <div className={cn("flex flex-wrap items-center gap-0.5 flex-1", showHtml && "opacity-30 pointer-events-none")}>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
            <Bold size={13} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
            <Italic size={13} />
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
            <Heading2 size={13} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
            <Heading3 size={13} />
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
            <List size={13} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
            <ListOrdered size={13} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
            <Quote size={13} />
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn onClick={setLink} active={editor.isActive("link")} title="Add link">
            <LinkIcon size={13} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Horizontal rule">
            <Minus size={13} />
          </ToolbarBtn>
        </div>
        <div className="ml-auto pl-1">
          <Sep />
        </div>
        <ToolbarBtn onClick={toggleHtml} active={showHtml} title={showHtml ? "Back to editor" : "View / edit HTML"}>
          <Code2 size={13} />
        </ToolbarBtn>
      </div>

      {/* Editor or raw HTML */}
      {showHtml ? (
        <textarea
          value={htmlValue}
          onChange={(e) => setHtmlValue(e.target.value)}
          spellCheck={false}
          className="w-full px-3 py-2 text-xs font-mono bg-[var(--background)] text-[var(--foreground)] resize-y min-h-[140px] outline-none"
        />
      ) : (
        <div className="px-3 py-2 bg-[var(--background)]">
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-[var(--border)] mx-0.5" />;
}

function ToolbarBtn({ onClick, active, title, children }: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
      )}
    >
      {children}
    </button>
  );
}
