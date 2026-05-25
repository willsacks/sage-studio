"use client";

import { useState, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { saveAsTemplate } from "@/lib/actions/offer-templates";
import { useBuilderStore } from "@/lib/store/builder";

export function SaveAsTemplateModal({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    let thumbnailUrl: string | undefined;

    // Try to capture thumbnail with html2canvas
    try {
      const canvasEl = document.querySelector("[data-builder-canvas]") as HTMLElement;
      if (canvasEl) {
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(canvasEl, {
          scale: 0.5,
          useCORS: true,
          allowTaint: true,
          width: 800,
          height: 600,
        });
        thumbnailUrl = canvas.toDataURL("image/jpeg", 0.8);
        // Note: in production this would be uploaded to Supabase storage
        // For now we skip uploading and leave thumbnail as null
        thumbnailUrl = undefined;
      }
    } catch {
      // Silently skip thumbnail on failure
    }

    const result = await saveAsTemplate(pageId, { name: name.trim(), description: description.trim() || undefined, thumbnailUrl });
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)]">Save as Template</h2>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Template Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Coaching Page Template"
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
