import { NextRequest, NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/server/auth/bearer";
import { findOperationByPath } from "@/lib/server/contract/registry";
import { runOperation } from "@/lib/server/contract/run-operation";

export const maxDuration = 30;

/** One catch-all route for every phase-1 read operation — matches
 * GET /api/v1/<op.http.path> against the registry (lib/server/contract/
 * registry.ts). No workspace segment in the path (unlike the spec this
 * was adapted from): every operation is already scoped to the
 * authenticated principal's own user_id by the RLS policies withRls sets
 * up, so there's nothing else to put in the URL. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = `/${path.join("/")}`;

  const auth = await authenticateBearer(request.headers.get("authorization"), "api");
  if (!auth.ok) {
    return NextResponse.json({ error: { code: "unauthenticated", message: auth.error } }, { status: 401 });
  }

  const found = findOperationByPath("GET", pathStr);
  if (!found) {
    return NextResponse.json({ error: { code: "not_found", message: "Unknown endpoint" } }, { status: 404 });
  }

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = await runOperation(found.op, auth.principal, { ...found.params, ...query });

  if ("error" in result) {
    const status = { forbidden_scope: 403, not_found: 404, invalid_input: 400 }[result.error.code] ?? 500;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { headers: { "X-Request-Id": auth.principal.requestId } });
}
