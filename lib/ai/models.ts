/**
 * Curated model choices for the AI page-editing assistant (app/api/ai-page-edit/route.ts).
 * Admin-selectable from /admin — see lib/actions/admin.ts (getAiModel/saveAiModel) and
 * components/admin/AiModelSelector.tsx. Not an exhaustive list of every available Claude
 * model — just a spread across cost/capability that makes sense for editing a web page.
 */

export interface AiModelOption {
  id: string;
  label: string;
  blurb: string;
}

export const AVAILABLE_AI_MODELS: AiModelOption[] = [
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", blurb: "Recommended — current generation" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", blurb: "Previous default" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", blurb: "Most capable, slower and pricier" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", blurb: "Fastest and cheapest" },
];

// Matches the model that was hardcoded before this became admin-configurable,
// so nothing changes in production until an admin actively picks something else.
export const DEFAULT_AI_MODEL = "claude-sonnet-4-6";
