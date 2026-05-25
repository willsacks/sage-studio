"use client";

import { useState, useEffect, useRef } from "react";
import type { ApplicationFormBlockData, FormField, FormFieldType } from "@/lib/types/builder";

const INJECTED_STYLES = `
  @keyframes _af_up   { from { opacity:0; transform:translateY(48px);  } to { opacity:1; transform:none; } }
  @keyframes _af_down { from { opacity:0; transform:translateY(-48px); } to { opacity:1; transform:none; } }
  @keyframes _af_spin { to { transform: rotate(360deg); } }
  ._af_fwd { animation: _af_up   .42s cubic-bezier(.22,1,.36,1) both; }
  ._af_bwd { animation: _af_down .42s cubic-bezier(.22,1,.36,1) both; }
  ._af_spin { animation: _af_spin .8s linear infinite; }
  ._af_input { background:transparent; border:none; border-bottom:2px solid rgba(255,255,255,0.2); outline:none; width:100%; color:inherit; font-family:inherit; font-size:clamp(1rem,2.5vw,1.2rem); padding:.5rem 0; transition:border-color .2s; }
  ._af_input:focus { border-bottom-color:var(--st-color-accent,#C9A84C); }
  ._af_input::placeholder { color:rgba(255,255,255,0.3); }
  ._af_input:disabled { opacity:.5; cursor:default; }
  ._af_textarea { background:transparent; border:2px solid rgba(255,255,255,0.2); outline:none; width:100%; color:inherit; font-family:inherit; font-size:clamp(1rem,2.5vw,1.2rem); padding:.875rem 1rem; border-radius:4px; resize:none; transition:border-color .2s; }
  ._af_textarea:focus { border-color:var(--st-color-accent,#C9A84C); }
  ._af_textarea::placeholder { color:rgba(255,255,255,0.3); }
  ._af_textarea:disabled { opacity:.5; cursor:default; }
`;

type Phase = "welcome" | "form" | "submitting" | "done";

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  multiple_choice: "Multiple choice",
  select_multiple: "Select multiple",
  email: "Email",
  phone: "Phone",
  rating: "Rating",
};

function MultipleChoiceInput({
  choices = [],
  value,
  onChange,
  onSelect,
  disabled,
}: {
  choices?: string[];
  value: string;
  onChange: (v: string) => void;
  onSelect: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {choices.map((choice, i) => {
        const isSelected = value === choice;
        const letter = String.fromCharCode(65 + i);
        return (
          <button
            key={choice}
            type="button"
            onClick={() => { if (!disabled) { onChange(choice); setTimeout(() => onSelect(choice), 180); } }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.875rem 1.25rem",
              border: isSelected
                ? "2px solid var(--st-color-accent,#C9A84C)"
                : "2px solid rgba(255,255,255,0.15)",
              borderRadius: 4,
              backgroundColor: isSelected
                ? "color-mix(in srgb,var(--st-color-accent,#C9A84C) 12%,transparent)"
                : "rgba(255,255,255,0.03)",
              color: "var(--st-color-text,#F5F0E8)",
              cursor: disabled ? "default" : "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
              fontFamily: "var(--st-font-body,\"Cormorant Garamond\"),serif",
              fontSize: "clamp(0.95rem,2vw,1.1rem)",
              width: "100%",
            }}
          >
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              border: `1.5px solid ${isSelected ? "var(--st-color-accent,#C9A84C)" : "rgba(255,255,255,0.3)"}`,
              borderRadius: 3,
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              flexShrink: 0,
              color: isSelected ? "var(--st-color-accent,#C9A84C)" : "rgba(255,255,255,0.5)",
            }}>
              {letter}
            </span>
            {choice}
          </button>
        );
      })}
    </div>
  );
}

function SelectMultipleInput({
  choices = [],
  value,
  onChange,
  disabled,
}: {
  choices?: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value ? value.split("|||") : []);

  function toggle(choice: string) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(choice)) next.delete(choice);
    else next.add(choice);
    onChange(Array.from(next).join("|||"));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {choices.map((choice) => {
        const isSelected = selected.has(choice);
        return (
          <button
            key={choice}
            type="button"
            onClick={() => toggle(choice)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.875rem 1.25rem",
              border: isSelected
                ? "2px solid var(--st-color-accent,#C9A84C)"
                : "2px solid rgba(255,255,255,0.15)",
              borderRadius: 4,
              backgroundColor: isSelected
                ? "color-mix(in srgb,var(--st-color-accent,#C9A84C) 12%,transparent)"
                : "rgba(255,255,255,0.03)",
              color: "var(--st-color-text,#F5F0E8)",
              cursor: disabled ? "default" : "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
              fontFamily: "var(--st-font-body,\"Cormorant Garamond\"),serif",
              fontSize: "clamp(0.95rem,2vw,1.1rem)",
              width: "100%",
            }}
          >
            {/* Checkbox indicator */}
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              border: `1.5px solid ${isSelected ? "var(--st-color-accent,#C9A84C)" : "rgba(255,255,255,0.3)"}`,
              borderRadius: 3,
              backgroundColor: isSelected ? "var(--st-color-accent,#C9A84C)" : "transparent",
              flexShrink: 0,
              fontSize: "0.75rem",
              color: "var(--st-color-text-inverse,#0E0C09)",
              transition: "all 0.15s ease",
            }}>
              {isSelected && "✓"}
            </span>
            {choice}
          </button>
        );
      })}
      {selected.size > 0 && (
        <p style={{ fontSize: "0.75rem", color: "var(--st-color-text-muted,#8A8070)", marginTop: "0.25rem" }}>
          {selected.size} selected
        </p>
      )}
    </div>
  );
}

function RatingInput({
  max = 5,
  value,
  onChange,
  disabled,
}: {
  max?: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const num = Number(value) || 0;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => { if (!disabled) onChange(String(n)); }}
          style={{
            width: 52,
            height: 52,
            border: num === n
              ? "2px solid var(--st-color-accent,#C9A84C)"
              : "2px solid rgba(255,255,255,0.2)",
            borderRadius: 4,
            backgroundColor: num === n ? "var(--st-color-accent,#C9A84C)" : "transparent",
            color: num === n ? "var(--st-color-text-inverse,#0E0C09)" : "var(--st-color-text,#F5F0E8)",
            cursor: disabled ? "default" : "pointer",
            fontSize: "1.05rem",
            fontWeight: 700,
            transition: "all 0.15s ease",
          }}
        >
          {n}
        </button>
      ))}
      {num > 0 && (
        <span style={{ fontSize: "0.85rem", color: "var(--st-color-text-muted,#C8BFB0)", marginLeft: "0.25rem" }}>
          {num} / {max}
        </span>
      )}
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
  onNext,
  onChoiceSelect,
  disabled,
  inputRef,
}: {
  question: FormField;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onChoiceSelect: (v: string) => void;
  disabled?: boolean;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}) {
  if (question.type === "multiple_choice") {
    return (
      <MultipleChoiceInput
        choices={question.choices}
        value={value}
        onChange={onChange}
        onSelect={onChoiceSelect}
        disabled={disabled}
      />
    );
  }

  if (question.type === "select_multiple") {
    return (
      <SelectMultipleInput
        choices={question.choices}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (question.type === "rating") {
    return (
      <RatingInput
        max={question.maxRating ?? 5}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (question.type === "long_text") {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement | null>}
        className="_af_textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder || "Your answer…"}
        disabled={disabled}
        rows={4}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onNext(); } }}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement | null>}
      className="_af_input"
      type={question.type === "email" ? "email" : question.type === "phone" ? "tel" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder || "Your answer…"}
      disabled={disabled}
      autoComplete={question.type === "email" ? "email" : question.type === "phone" ? "tel" : "off"}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onNext(); } }}
    />
  );
}

export function ApplicationFormBlock({
  data,
  isEditing,
  siteSlug,
}: {
  data: ApplicationFormBlockData;
  isEditing?: boolean;
  siteSlug?: string;
}) {
  const questions = data.questions ?? [];
  const [phase, setPhase] = useState<Phase>("welcome");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [val, setVal] = useState("");
  const [error, setError] = useState("");
  const [animKey, setAnimKey] = useState(0);
  const [animClass, setAnimClass] = useState("_af_fwd");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const q = phase === "form" ? (questions[idx] ?? null) : null;
  const isLast = idx === questions.length - 1;
  const progress = phase === "form" ? idx / Math.max(questions.length, 1) : phase === "done" ? 1 : 0;

  function animate(dir: "fwd" | "bwd") {
    setAnimClass(dir === "fwd" ? "_af_fwd" : "_af_bwd");
    setAnimKey((k) => k + 1);
  }

  function start() {
    if (isEditing || questions.length === 0) return;
    setVal(answers[questions[0]?.id ?? ""] ?? "");
    setError("");
    animate("fwd");
    setIdx(0);
    setPhase("form");
  }

  function handleNext() {
    if (isEditing || !q) return;
    if (q.required && !val.trim()) {
      setError("Please answer this question to continue.");
      return;
    }
    const updated = { ...answers, [q.id]: val };
    setAnswers(updated);
    setError("");

    if (!isLast) {
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      setVal(updated[questions[nextIdx]?.id ?? ""] ?? "");
      animate("fwd");
    } else {
      void submit(updated);
    }
  }

  function handleBack() {
    if (isEditing) return;
    if (idx === 0) { setPhase("welcome"); return; }
    const prevIdx = idx - 1;
    setIdx(prevIdx);
    setVal(answers[questions[prevIdx]?.id ?? ""] ?? "");
    setError("");
    animate("bwd");
  }

  async function submit(allAnswers: Record<string, string>) {
    setPhase("submitting");
    try {
      await fetch("/api/form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTitle: data.welcomeTitle ?? "Application Form",
          siteSlug,
          notificationEmail: data.notificationEmail,
          answers: allAnswers,
          questions: questions.map((q) => ({ id: q.id, label: q.label, type: q.type })),
        }),
      });
    } catch {
      // Proceed to thank-you even on network error
    }
    setPhase("done");
  }

  // Auto-focus input when question changes
  useEffect(() => {
    if (phase === "form" && !isEditing) {
      const t = setTimeout(() => inputRef.current?.focus(), 420);
      return () => clearTimeout(t);
    }
  }, [phase, idx, isEditing]);

  const minH = isEditing ? "65vh" : "100vh";

  const accentStyle: React.CSSProperties = { color: "var(--st-color-accent,#C9A84C)" };

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.6rem",
    padding: "0.875rem 2.25rem",
    backgroundColor: "var(--st-color-accent,#C9A84C)",
    color: "var(--st-color-text-inverse,#0E0C09)",
    border: "none",
    borderRadius: "var(--st-border-radius-button,2px)",
    fontFamily: "var(--st-font-display,\"Playfair Display\"),serif",
    fontSize: "0.85rem",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    cursor: isEditing ? "default" : "pointer",
    transition: "opacity .2s",
  };

  const ghostBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "var(--st-color-text-muted,#8A8070)",
    cursor: isEditing ? "default" : "pointer",
    fontSize: "0.85rem",
    padding: "0.5rem 0",
    fontFamily: "var(--st-font-body,\"Cormorant Garamond\"),serif",
  };

  return (
    <section
      style={{
        minHeight: minH,
        backgroundColor: "var(--st-color-background,#0E0C09)",
        color: "var(--st-color-text,#F5F0E8)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{INJECTED_STYLES}</style>

      {/* Progress bar */}
      {phase === "form" && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.08)", zIndex: 10 }}>
          <div style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: "var(--st-color-accent,#C9A84C)", transition: "width .5s ease" }} />
        </div>
      )}

      {/* Back button — top-left when in form */}
      {phase === "form" && (
        <div style={{ position: "absolute", top: "1.25rem", left: "1.5rem", zIndex: 10 }}>
          <button style={ghostBtnStyle} onClick={handleBack}>
            ← Back
          </button>
        </div>
      )}

      {/* Question counter — top-right when in form */}
      {phase === "form" && q && (
        <div style={{ position: "absolute", top: "1.25rem", right: "1.5rem", zIndex: 10, fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--st-color-text-muted,#8A8070)" }}>
          {idx + 1} / {questions.length}
        </div>
      )}

      {/* Main content — vertically centered */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(3rem,8vw,6rem) clamp(1.5rem,8vw,5rem)", maxWidth: 700, margin: "0 auto", width: "100%" }}>

        {/* ── WELCOME ── */}
        {phase === "welcome" && (
          <div className="_af_fwd" style={{ textAlign: "center", width: "100%" }}>
            <h1 style={{
              fontFamily: "var(--st-font-display,\"Playfair Display\"),serif",
              fontSize: "clamp(2rem,6vw,3.75rem)",
              fontWeight: 300,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              marginBottom: "1.25rem",
            }}>
              {data.welcomeTitle || "Apply Now"}
            </h1>
            {data.welcomeSubtitle && (
              <p style={{ fontFamily: "var(--st-font-body,\"Cormorant Garamond\"),serif", fontSize: "clamp(1rem,2.5vw,1.2rem)", color: "var(--st-color-text-muted,#C8BFB0)", lineHeight: 1.7, marginBottom: "3rem", maxWidth: 520, margin: "0 auto 3rem" }}>
                {data.welcomeSubtitle}
              </p>
            )}
            <button style={btnStyle} onClick={start}
              onMouseEnter={(e) => { if (!isEditing) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              {data.welcomeButtonText || "Start Application"}
              <span style={{ fontSize: "1rem" }}>→</span>
            </button>
            {questions.length > 0 && (
              <p style={{ marginTop: "1.75rem", fontSize: "0.75rem", color: "var(--st-color-text-muted,#6B6560)", letterSpacing: "0.08em" }}>
                {questions.length} question{questions.length !== 1 ? "s" : ""} · takes about {Math.ceil(questions.length * 0.5)} min
              </p>
            )}
          </div>
        )}

        {/* ── QUESTION ── */}
        {phase === "form" && q && (
          <div key={animKey} className={animClass} style={{ width: "100%" }}>
            {/* Question label */}
            <h2 style={{
              fontFamily: "var(--st-font-display,\"Playfair Display\"),serif",
              fontSize: "clamp(1.4rem,4vw,2.25rem)",
              fontWeight: 400,
              lineHeight: 1.25,
              marginBottom: q.description ? "0.75rem" : "2rem",
            }}>
              {q.label}
              {q.required && <span style={{ ...accentStyle, marginLeft: 4 }}>*</span>}
            </h2>

            {q.description && (
              <p style={{ fontSize: "1rem", color: "var(--st-color-text-muted,#C8BFB0)", lineHeight: 1.6, marginBottom: "2rem" }}>
                {q.description}
              </p>
            )}

            {/* Input */}
            <QuestionInput
              question={q}
              value={val}
              onChange={setVal}
              onNext={handleNext}
              onChoiceSelect={handleNext}
              disabled={isEditing}
              inputRef={inputRef}
            />

            {/* Error */}
            {error && (
              <p style={{ color: "#F87171", fontSize: "0.82rem", marginTop: "0.75rem" }}>⚠ {error}</p>
            )}

            {/* OK button + hint */}
            {q.type !== "multiple_choice" && (
              <div style={{ marginTop: "2rem" }}>
                <button style={btnStyle} onClick={isEditing ? undefined : handleNext}
                  onMouseEnter={(e) => { if (!isEditing) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  {isLast ? (data.submitButtonText || "Submit") : "OK"}
                  <span style={{ fontSize: "0.9rem" }}>✓</span>
                </button>
                <p style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "var(--st-color-text-muted,#6B6560)", letterSpacing: "0.06em" }}>
                  {q.type === "long_text"
                    ? <>press <strong>⌘ Enter</strong> to continue</>
                    : q.type === "select_multiple"
                    ? <>select all that apply, then click OK</>
                    : <>press <strong>Enter ↵</strong> to continue</>
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── SUBMITTING ── */}
        {phase === "submitting" && (
          <div style={{ textAlign: "center" }}>
            <div className="_af_spin" style={{ width: 36, height: 36, border: "2px solid var(--st-color-accent,#C9A84C)", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 1.5rem" }} />
            <p style={{ color: "var(--st-color-text-muted,#C8BFB0)", fontFamily: "var(--st-font-body,\"Cormorant Garamond\"),serif" }}>
              Submitting your application…
            </p>
          </div>
        )}

        {/* ── THANK YOU ── */}
        {phase === "done" && (
          <div className="_af_fwd" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1.5rem", ...accentStyle }}>✦</div>
            <h2 style={{ fontFamily: "var(--st-font-display,\"Playfair Display\"),serif", fontSize: "clamp(1.75rem,4vw,3rem)", fontWeight: 300, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
              {data.thankYouTitle || "Application Received"}
            </h2>
            <p style={{ fontFamily: "var(--st-font-body,\"Cormorant Garamond\"),serif", fontSize: "1.1rem", color: "var(--st-color-text-muted,#C8BFB0)", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
              {data.thankYouMessage || "We've received your application and will be in touch soon."}
            </p>
          </div>
        )}

      </div>

      {/* Editing overlay — shows field type list as a hint */}
      {isEditing && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: "1rem" }}>
          <div style={{ backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "0.75rem 1rem", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, backdropFilter: "blur(4px)" }}>
            {questions.length === 0
              ? "No questions yet — add some in settings"
              : questions.map((q, i) => (
                  <div key={q.id}>{i + 1}. {q.label} <span style={{ opacity: 0.5 }}>({FIELD_TYPE_LABELS[q.type]})</span></div>
                ))
            }
          </div>
        </div>
      )}
    </section>
  );
}
