"use client";

import { useState } from "react";
import type { SimpleFormBlockData } from "@/lib/types/builder";

export function SimpleFormBlock({
  data,
  isEditing,
}: {
  data: SimpleFormBlockData;
  isEditing?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fields = data.fields ?? [];

  function handleChange(id: string, value: string) {
    setValues((v) => ({ ...v, [id]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEditing) return;
    setSubmitting(true);
    try {
      if (data.notificationEmail) {
        await fetch("/api/simple-form", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: values, to: data.notificationEmail }),
        });
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.875rem",
    fontSize: "var(--st-font-size-body, 1rem)",
    backgroundColor: "var(--st-color-surface, #1A1712)",
    color: "var(--st-color-text, #D4C9B0)",
    border: "1px solid var(--st-color-border, rgba(201,168,76,0.2))",
    borderRadius: "var(--st-border-radius, 2px)",
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical" as const,
  };

  return (
    <section
      className="w-full px-8 py-16"
      style={{ backgroundColor: "var(--st-color-background, #0E0C09)" }}
    >
      <div className="max-w-2xl mx-auto">
        {(data.heading || data.subheading) && (
          <div className="mb-8 text-center">
            {data.heading && (
              <h2
                className="font-bold"
                style={{
                  color: "var(--st-color-heading, #F5F0E8)",
                  fontFamily: "var(--st-font-display, serif)",
                  fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
                }}
              >
                {data.heading}
              </h2>
            )}
            {data.subheading && (
              <p
                className="mt-2"
                style={{
                  color: "var(--st-color-text-muted, #8A8070)",
                  fontSize: "var(--st-font-size-body, 1rem)",
                }}
              >
                {data.subheading}
              </p>
            )}
          </div>
        )}

        {submitted ? (
          <div
            className="text-center py-12"
            style={{ color: "var(--st-color-text, #D4C9B0)" }}
          >
            <div
              className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-full"
              style={{ backgroundColor: "color-mix(in srgb, var(--st-color-accent, #C9A84C) 15%, transparent)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ fontSize: "var(--st-font-size-body, 1rem)" }}>
              {data.successMessage || "Thank you! I'll be in touch soon."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-4">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className={field.halfWidth ? "flex-1 min-w-[calc(50%-0.5rem)]" : "w-full"}
                >
                  <label
                    className="block mb-1.5 text-sm font-medium"
                    style={{ color: "var(--st-color-text-muted, #8A8070)" }}
                  >
                    {field.label}
                    {field.required && (
                      <span style={{ color: "var(--st-color-accent, #C9A84C)", marginLeft: "0.25rem" }}>*</span>
                    )}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={values[field.id] ?? ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      rows={4}
                      style={inputStyle}
                    />
                  ) : (
                    <input
                      type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                      value={values[field.id] ?? ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  padding: "0.75rem 2rem",
                  backgroundColor: "var(--st-color-accent, #C9A84C)",
                  color: "#0E0C09",
                  fontFamily: "var(--st-font-display, serif)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  border: "none",
                  borderRadius: "var(--st-border-radius, 2px)",
                  cursor: submitting ? "wait" : "pointer",
                }}
              >
                {submitting ? "Sending…" : (data.submitText || "Send Message")}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
