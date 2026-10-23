"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { CourseEnrollBlockData } from "@/lib/types/builder";

/** Mirrors PricingCardBlock.tsx's handleStripeCheckout shape, just posting
 * to /api/course-checkout instead of /api/checkout — that route resolves
 * the creator's Stripe Connect account and resolved platform fee itself,
 * so this component only ever needs a courseId. */
export function CourseEnrollBlock({ data, isEditing }: { data: CourseEnrollBlockData; isEditing?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnroll(e: React.MouseEvent) {
    if (isEditing || !data.courseId) return;
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/course-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: data.courseId }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setError(json.error ?? "Something went wrong");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!data.courseId) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10 text-center text-sm text-[var(--muted-foreground)]">
        {isEditing ? "Choose a course in the settings panel on the right." : null}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10 text-center space-y-4">
      <h3 className="text-2xl font-bold">{data.courseTitle ?? "Course"}</h3>
      {data.description && <p className="text-[var(--muted-foreground)]">{data.description}</p>}
      {typeof data.priceCents === "number" && (
        <p className="text-3xl font-bold">${(data.priceCents / 100).toFixed(2)}</p>
      )}
      <button
        onClick={handleEnroll}
        disabled={loading || isEditing}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-white bg-[var(--accent-color,#C9A84C)] disabled:opacity-60"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {data.buttonText || "Enroll Now"}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
