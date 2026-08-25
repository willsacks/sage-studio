import { cookies } from "next/headers";
import { verifyGateToken } from "@/lib/crypto";

export const PAGE_GATE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function pageGateCookieName(pageId: string): string {
  return `sage_pgate_${pageId}`;
}

export interface PageGateFields {
  isGated: boolean;
  gateTitle: string | null;
  gateDescription: string | null;
  gateButtonText: string | null;
}

/** Extracts the gate columns off a site_pages row. A single cast site for
 * the `is_gated`/`gate_*` columns, which aren't in the generated Supabase
 * types (added via a one-off script, see scripts/add-email-gate-schema.ts,
 * consistent with how this table's other ad-hoc columns are handled
 * elsewhere in the codebase). */
export function getPageGateFields(page: unknown): PageGateFields {
  const p = page as {
    is_gated?: boolean | null;
    gate_title?: string | null;
    gate_description?: string | null;
    gate_button_text?: string | null;
  };
  return {
    isGated: p.is_gated ?? false,
    gateTitle: p.gate_title ?? null,
    gateDescription: p.gate_description ?? null,
    gateButtonText: p.gate_button_text ?? null,
  };
}

/** Whether the current visitor has unlocked a gated page — checks a
 * signed cookie (see lib/crypto.ts's signGateToken/verifyGateToken) rather
 * than a bare flag value, so a visitor can't just set
 * `sage_pgate_<pageId>=1` themselves via devtools to bypass the gate. */
export async function isPageUnlocked(pageId: string, isGated: boolean): Promise<boolean> {
  if (!isGated) return true;
  const token = (await cookies()).get(pageGateCookieName(pageId))?.value;
  return !!token && verifyGateToken(pageId, token);
}
