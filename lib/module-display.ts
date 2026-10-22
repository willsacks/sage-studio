import { Globe, Wallet, Mail, GraduationCap, CheckSquare, Timer, GitBranch, Workflow, BookOpen, type LucideIcon } from "lucide-react";
import type { Module } from "@/lib/server/auth/principal";

/** Same order and icons as the real sidebar nav (components/nav/Sidebar.tsx's
 * NAV array) — shown wherever a user picks which modules an assistant can
 * access (OAuth consent screen, Settings → Connected Apps), so the modules
 * are recognizable as the same sections of the app they already use rather
 * than a separately-invented list. */
export const MODULE_DISPLAY_ORDER: Module[] = ["sites", "finance", "newsletter", "courses", "todos", "time_tracking", "pipeline", "process", "knowledge"];

export const MODULE_DISPLAY: Record<Module, { label: string; icon: LucideIcon }> = {
  sites: { label: "Sites", icon: Globe },
  finance: { label: "Finances", icon: Wallet },
  newsletter: { label: "Newsletter", icon: Mail },
  courses: { label: "Courses", icon: GraduationCap },
  todos: { label: "To Do's", icon: CheckSquare },
  time_tracking: { label: "Time Tracker", icon: Timer },
  pipeline: { label: "Pipeline", icon: GitBranch },
  process: { label: "Process", icon: Workflow },
  knowledge: { label: "Knowledge", icon: BookOpen },
};

/** Sorts a subset of modules into the shared display order. */
export function sortByDisplayOrder(modules: Module[]): Module[] {
  return [...modules].sort((a, b) => MODULE_DISPLAY_ORDER.indexOf(a) - MODULE_DISPLAY_ORDER.indexOf(b));
}
