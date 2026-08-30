import { verifyQboState } from "@/lib/crypto";

export type QboCreateState = { userId: string; mode?: undefined; intendedEntityName: string; entityType: "personal" | "business" };
export type QboReconnectState = { userId: string; mode: "reconnect"; entityId: string };
export type QboState = QboCreateState | QboReconnectState;

/** Verifies and decodes a QuickBooks OAuth `state` param. Kept out of
 * lib/actions/finance-qbo.ts because "use server" files may only export
 * async functions (Server Actions) — a plain synchronous helper exported
 * from one crashes at runtime with a ReferenceError once Next.js's Server
 * Actions compiler strips it, the same bug class that took down the entire
 * /finances route earlier this session via a type-only re-export. */
export function parseQboState(state: string): QboState | null {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature || !verifyQboState(encodedPayload, signature)) return null;
  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
